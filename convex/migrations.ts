import type { PaginationResult } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { backfill, readPlatformTotals } from "./lib/platformStats";
import { ensureBuiltInRoles } from "./lib/roles";
import { presetLook } from "./lib/looks/presets";
import type { PresetId } from "./lib/looks/validators";
import { loggedValue } from "./lib/shopChanges";
import { notify } from "./lib/notify";
import { readPlanConfig, seedPlanConfig } from "./lib/planConfig";
import { gainedFeatures } from "./lib/planFeatures";
import { startTrial, subscriptionDoc } from "./lib/subscriptions";

/**
 * One-time data migrations, run from the terminal (README "Migrating
 * existing data"):
 *
 *   npx convex run migrations:rbacV1
 *   npx convex run migrations:rbacV1Status
 *
 * rbacV1: existing users become active sellers (an existing role or status
 * is never overwritten), shops become active, products visible, and the
 * platform counters are backfilled. Batched and self-scheduling so it
 * stays within transaction limits; every write is idempotent.
 *
 *   npx convex run migrations:billingV1
 *   npx convex run migrations:billingV1Status
 *
 * billingV1: every shop without a subscription gets a fresh trial starting
 * now (CLAUDE.md "Billing"). Shops that already have one are left alone.
 *
 *   npx convex run migrations:notificationsV1
 *   npx convex run migrations:notificationsV1Status
 *
 * notificationsV1: moves change-request decisions from the old
 * `sellerNotifications` table into `notifications` (read state kept; the
 * time becomes the migration's), then deletes the old rows.
 *
 *   npx convex run migrations:looksV1
 *   npx convex run migrations:looksV1Status
 *
 * looksV1: the old look picker (`shops.theme`: bold / soft / dark) moves to
 * `shopLooks` as a published preset (bold → Classic, soft → Blush, dark →
 * Noir), then `shops.theme` is cleared. A shop that already has a look
 * keeps it.
 *
 *   npx convex run migrations:plansV1
 *   npx convex run migrations:plansV1Status
 *
 *   npx convex run migrations:trialProOnlyV1
 *   npx convex run migrations:trialProOnlyV1Status
 *
 * trialProOnlyV1: the free trial is Pro only (CLAUDE.md "Billing"). Trial
 * shops already had Pro limits, so nothing about their plan changes:
 * subscriptions, trial end dates and admin exceptions are never touched.
 * Trial shops that have Business-only features turned on (an active shop
 * exception for one, or saved discount codes) get one notification
 * (`plan.trialProOnly`) explaining that those need Business.
 *
 * plansV1: stores the plan configuration seed (`planDefaults.ts`, the
 * plans as they were in code) in `planConfig`, so admins can edit it. An
 * existing configuration is never overwritten. Optional: until it runs,
 * the app reads the same seed. Subscriptions, shops and trials are untouched.
 *
 *   npx convex run migrations:emailVerifiedV1 '{"before": <deploy time in ms>}'
 *   npx convex run migrations:emailVerifiedV1Status
 *
 * emailVerifiedV1: sign-up now needs an emailed code (CLAUDE.md "Auth
 * codes"). Password accounts created before `before` (the deploy that
 * turned codes on) count as verified, so their owners sign in as before.
 * Accounts created after it keep waiting for their code. Until it runs, an
 * older account signing in just gets a code. Idempotent.
 */

const NAME = "rbacV1";
const BATCH = 100;

const PHASES = ["users", "shops", "products", "shopDailyStats"] as const;
type Phase = (typeof PHASES)[number];
const phaseValidator = v.union(
  v.literal("users"),
  v.literal("shops"),
  v.literal("products"),
  v.literal("shopDailyStats"),
);

async function findRun(ctx: QueryCtx, name: string) {
  return await ctx.db
    .query("migrations")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
}

export const rbacV1 = internalMutation({
  args: {},
  returns: v.union(v.literal("started"), v.literal("already_running"), v.literal("already_done")),
  handler: async (ctx) => {
    const run = await findRun(ctx, NAME);
    if (run?.status === "done") return "already_done" as const;
    if (run?.status === "running") return "already_running" as const;
    await ensureBuiltInRoles(ctx);
    await ctx.db.insert("migrations", { name: NAME, status: "running", startedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.migrations.rbacV1Step, { phase: "users", cursor: null });
    return "started" as const;
  },
});

async function migrateBatch(
  ctx: MutationCtx,
  phase: Phase,
  cursor: string | null,
  sellerRoleId: Id<"roles">,
): Promise<PaginationResult<unknown>> {
  const opts = { numItems: BATCH, cursor };
  switch (phase) {
    case "users": {
      const page = await ctx.db.query("users").paginate(opts);
      for (const user of page.page) {
        const patch: Partial<Doc<"users">> = {};
        if (user.roleId === undefined) patch.roleId = sellerRoleId;
        if (user.status === undefined) patch.status = "active";
        if (Object.keys(patch).length > 0) await ctx.db.patch("users", user._id, patch);
        await backfill.user(ctx, user);
      }
      return page;
    }
    case "shops": {
      const page = await ctx.db.query("shops").paginate(opts);
      for (const shop of page.page) {
        if (shop.status === undefined) await ctx.db.patch("shops", shop._id, { status: "active" });
        await backfill.shop(ctx, shop);
      }
      return page;
    }
    case "products": {
      const page = await ctx.db.query("products").paginate(opts);
      for (const product of page.page) {
        if (product.hidden === undefined) await ctx.db.patch("products", product._id, { hidden: false });
        await backfill.product(ctx, product);
      }
      return page;
    }
    case "shopDailyStats": {
      const page = await ctx.db.query("shopDailyStats").paginate(opts);
      for (const row of page.page) await backfill.shopDayStats(ctx, row);
      return page;
    }
  }
}

/** One batch of one phase, then schedules the next batch / phase / finish. */
export const rbacV1Step = internalMutation({
  args: { phase: phaseValidator, cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { phase, cursor }) => {
    const { seller } = await ensureBuiltInRoles(ctx);
    const page = await migrateBatch(ctx, phase, cursor, seller);

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.rbacV1Step, {
        phase,
        cursor: page.continueCursor,
      });
      return null;
    }
    const next = PHASES[PHASES.indexOf(phase) + 1];
    if (next !== undefined) {
      await ctx.scheduler.runAfter(0, internal.migrations.rbacV1Step, { phase: next, cursor: null });
      return null;
    }
    const run = await findRun(ctx, NAME);
    if (run) await ctx.db.patch("migrations", run._id, { status: "done", doneAt: Date.now() });
    return null;
  },
});

export const rbacV1Status = internalQuery({
  args: {},
  returns: v.object({
    status: v.union(v.literal("not_started"), v.literal("running"), v.literal("done")),
    doneAt: v.union(v.number(), v.null()),
    totals: v.object({
      users: v.number(),
      shops: v.number(),
      products: v.number(),
      whatsappClicks: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const run = await findRun(ctx, NAME);
    return {
      status: run?.status ?? ("not_started" as const),
      doneAt: run?.doneAt ?? null,
      totals: await readPlatformTotals(ctx),
    };
  },
});

// ---------------------------------------------------------------------------
// billingV1: a trial for every shop created before billing shipped.

const BILLING_V1 = "billingV1";

export const billingV1 = internalMutation({
  args: {},
  returns: v.union(v.literal("started"), v.literal("already_running"), v.literal("already_done")),
  handler: async (ctx) => {
    const run = await findRun(ctx, BILLING_V1);
    if (run?.status === "done") return "already_done" as const;
    if (run?.status === "running") return "already_running" as const;
    await ctx.db.insert("migrations", { name: BILLING_V1, status: "running", startedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.migrations.billingV1Step, { cursor: null });
    return "started" as const;
  },
});

export const billingV1Step = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("shops").paginate({ numItems: BATCH, cursor });
    const now = Date.now();
    for (const shop of page.page) {
      if ((await subscriptionDoc(ctx, shop._id)) === null) await startTrial(ctx, shop, now);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.billingV1Step, { cursor: page.continueCursor });
      return null;
    }
    const run = await findRun(ctx, BILLING_V1);
    if (run) await ctx.db.patch("migrations", run._id, { status: "done", doneAt: Date.now() });
    return null;
  },
});

export const billingV1Status = internalQuery({
  args: {},
  returns: v.object({
    status: v.union(v.literal("not_started"), v.literal("running"), v.literal("done")),
    doneAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const run = await findRun(ctx, BILLING_V1);
    return { status: run?.status ?? ("not_started" as const), doneAt: run?.doneAt ?? null };
  },
});

// ---------------------------------------------------------------------------
// notificationsV1: sellerNotifications → notifications.

const NOTIFICATIONS_V1 = "notificationsV1";

export const notificationsV1 = internalMutation({
  args: {},
  returns: v.union(v.literal("started"), v.literal("already_running"), v.literal("already_done")),
  handler: async (ctx) => {
    const run = await findRun(ctx, NOTIFICATIONS_V1);
    if (run?.status === "done") return "already_done" as const;
    if (run?.status === "running") return "already_running" as const;
    await ctx.db.insert("migrations", { name: NOTIFICATIONS_V1, status: "running", startedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.migrations.notificationsV1Step, {});
    return "started" as const;
  },
});

export const notificationsV1Step = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const rows = await ctx.db.query("sellerNotifications").take(BATCH);
    for (const old of rows) {
      const request = await ctx.db.get("shopChangeRequests", old.requestId);
      const dedupeKey = `cr.decided:${old.requestId}`;
      const exists = await ctx.db
        .query("notifications")
        .withIndex("by_userId_and_dedupeKey", (q) => q.eq("userId", old.userId).eq("dedupeKey", dedupeKey))
        .first();
      if (request && !exists) {
        const value = loggedValue(request.field, request.newValue);
        await ctx.db.insert("notifications", {
          userId: old.userId,
          category: "changeRequests",
          data:
            old.kind === "changeRequest.approved"
              ? { type: "changeRequest.approved", requestId: request._id, field: request.field, value }
              : {
                  type: "changeRequest.rejected",
                  requestId: request._id,
                  field: request.field,
                  value,
                  reason: request.decisionReason ?? "",
                },
          dedupeKey,
          readAt: old.readAt,
        });
      }
      await ctx.db.delete("sellerNotifications", old._id);
    }
    if (rows.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.migrations.notificationsV1Step, {});
      return null;
    }
    const run = await findRun(ctx, NOTIFICATIONS_V1);
    if (run) await ctx.db.patch("migrations", run._id, { status: "done", doneAt: Date.now() });
    return null;
  },
});

export const notificationsV1Status = internalQuery({
  args: {},
  returns: v.object({
    status: v.union(v.literal("not_started"), v.literal("running"), v.literal("done")),
    left: v.number(),
  }),
  handler: async (ctx) => {
    const run = await findRun(ctx, NOTIFICATIONS_V1);
    const left = (await ctx.db.query("sellerNotifications").take(BATCH)).length;
    return { status: run?.status ?? ("not_started" as const), left };
  },
});

// ---------------------------------------------------------------------------
// looksV1: shops.theme → shopLooks.

const LOOKS_V1 = "looksV1";

const THEME_TO_PRESET: Record<NonNullable<Doc<"shops">["theme"]>, PresetId> = {
  bold: "classic",
  soft: "blush",
  dark: "noir",
};

export const looksV1 = internalMutation({
  args: {},
  returns: v.union(v.literal("started"), v.literal("already_running"), v.literal("already_done")),
  handler: async (ctx) => {
    const run = await findRun(ctx, LOOKS_V1);
    if (run?.status === "done") return "already_done" as const;
    if (run?.status === "running") return "already_running" as const;
    await ctx.db.insert("migrations", { name: LOOKS_V1, status: "running", startedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.migrations.looksV1Step, { cursor: null });
    return "started" as const;
  },
});

export const looksV1Step = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("shops").paginate({ numItems: BATCH, cursor });
    const now = Date.now();
    for (const shop of page.page) {
      if (shop.theme === undefined) continue;
      const existing = await ctx.db
        .query("shopLooks")
        .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
        .unique();
      if (!existing) {
        await ctx.db.insert("shopLooks", {
          shopId: shop._id,
          published: presetLook(THEME_TO_PRESET[shop.theme]),
          publishedAt: now,
        });
      }
      await ctx.db.patch("shops", shop._id, { theme: undefined });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.looksV1Step, { cursor: page.continueCursor });
      return null;
    }
    const run = await findRun(ctx, LOOKS_V1);
    if (run) await ctx.db.patch("migrations", run._id, { status: "done", doneAt: Date.now() });
    return null;
  },
});

export const looksV1Status = internalQuery({
  args: {},
  returns: v.object({
    status: v.union(v.literal("not_started"), v.literal("running"), v.literal("done")),
    doneAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const run = await findRun(ctx, LOOKS_V1);
    return { status: run?.status ?? ("not_started" as const), doneAt: run?.doneAt ?? null };
  },
});

// ---------------------------------------------------------------------------
// plansV1: the plan configuration moves from code to `planConfig`.

const PLANS_V1 = "plansV1";

export const plansV1 = internalMutation({
  args: {},
  returns: v.union(v.literal("seeded"), v.literal("already_configured"), v.literal("already_done")),
  handler: async (ctx) => {
    const run = await findRun(ctx, PLANS_V1);
    if (run?.status === "done") return "already_done" as const;
    const seeded = await seedPlanConfig(ctx);
    const now = Date.now();
    if (run) await ctx.db.patch("migrations", run._id, { status: "done", doneAt: now });
    else await ctx.db.insert("migrations", { name: PLANS_V1, status: "done", startedAt: now, doneAt: now });
    return seeded ? ("seeded" as const) : ("already_configured" as const);
  },
});

export const plansV1Status = internalQuery({
  args: {},
  returns: v.object({
    status: v.union(v.literal("not_started"), v.literal("running"), v.literal("done")),
    doneAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const run = await findRun(ctx, PLANS_V1);
    return { status: run?.status ?? ("not_started" as const), doneAt: run?.doneAt ?? null };
  },
});

// ---------------------------------------------------------------------------
// trialProOnlyV1: a note for trial shops using Business-only features.

const TRIAL_PRO_ONLY_V1 = "trialProOnlyV1";

export const trialProOnlyV1 = internalMutation({
  args: {},
  returns: v.union(v.literal("started"), v.literal("already_running"), v.literal("already_done")),
  handler: async (ctx) => {
    const run = await findRun(ctx, TRIAL_PRO_ONLY_V1);
    if (run?.status === "done") return "already_done" as const;
    if (run?.status === "running") return "already_running" as const;
    await ctx.db.insert("migrations", { name: TRIAL_PRO_ONLY_V1, status: "running", startedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.migrations.trialProOnlyV1Step, { cursor: null });
    return "started" as const;
  },
});

export const trialProOnlyV1Step = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const businessOnly = new Set<string>(gainedFeatures(await readPlanConfig(ctx), "pro", "business"));
    const page = await ctx.db
      .query("subscriptions")
      .withIndex("by_status_and_periodEnd", (q) => q.eq("status", "trialing"))
      .paginate({ numItems: BATCH, cursor });
    for (const sub of page.page) {
      const shop = await ctx.db.get("shops", sub.shopId);
      if (!shop) continue;
      const exceptions = await ctx.db
        .query("planExceptions")
        .withIndex("by_shopId_and_active", (q) => q.eq("shopId", shop._id).eq("active", true))
        .take(20);
      const codes = await ctx.db
        .query("discountCodes")
        .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
        .take(1);
      const usesBusiness = codes.length > 0 || exceptions.some((e) => businessOnly.has(e.feature));
      if (!usesBusiness) continue;
      await notify(ctx, {
        data: { type: "plan.trialProOnly" },
        to: { userId: shop.ownerId },
        dedupeKey: `plan.trialProOnly:${shop._id}`,
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.trialProOnlyV1Step, { cursor: page.continueCursor });
      return null;
    }
    const run = await findRun(ctx, TRIAL_PRO_ONLY_V1);
    if (run) await ctx.db.patch("migrations", run._id, { status: "done", doneAt: Date.now() });
    return null;
  },
});

export const trialProOnlyV1Status = internalQuery({
  args: {},
  returns: v.object({
    status: v.union(v.literal("not_started"), v.literal("running"), v.literal("done")),
    doneAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const run = await findRun(ctx, TRIAL_PRO_ONLY_V1);
    return { status: run?.status ?? ("not_started" as const), doneAt: run?.doneAt ?? null };
  },
});

const EMAIL_VERIFIED_V1 = "emailVerifiedV1";

export const emailVerifiedV1 = internalMutation({
  args: { before: v.number() },
  returns: v.union(v.literal("started"), v.literal("already_running"), v.literal("already_done")),
  handler: async (ctx, { before }) => {
    // A cutoff in the future would skip the code for brand-new accounts.
    if (!Number.isFinite(before) || before > Date.now()) throw new Error("`before` must be a past time in ms");
    const run = await findRun(ctx, EMAIL_VERIFIED_V1);
    if (run?.status === "done") return "already_done" as const;
    if (run?.status === "running") return "already_running" as const;
    await ctx.db.insert("migrations", { name: EMAIL_VERIFIED_V1, status: "running", startedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.migrations.emailVerifiedV1Step, { before, cursor: null });
    return "started" as const;
  },
});

export const emailVerifiedV1Step = internalMutation({
  args: { before: v.number(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { before, cursor }) => {
    const page = await ctx.db
      .query("authAccounts")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", before))
      .paginate({ numItems: BATCH, cursor });
    for (const account of page.page) {
      if (account.provider !== "password") continue;
      if (account.emailVerified === undefined) {
        await ctx.db.patch("authAccounts", account._id, { emailVerified: account.providerAccountId });
      }
      const user = await ctx.db.get("users", account.userId);
      if (user && user.emailVerificationTime === undefined) {
        await ctx.db.patch("users", user._id, { emailVerificationTime: before });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.emailVerifiedV1Step, { before, cursor: page.continueCursor });
      return null;
    }
    const run = await findRun(ctx, EMAIL_VERIFIED_V1);
    if (run) await ctx.db.patch("migrations", run._id, { status: "done", doneAt: Date.now() });
    return null;
  },
});

export const emailVerifiedV1Status = internalQuery({
  args: {},
  returns: v.object({
    status: v.union(v.literal("not_started"), v.literal("running"), v.literal("done")),
    doneAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const run = await findRun(ctx, EMAIL_VERIFIED_V1);
    return { status: run?.status ?? ("not_started" as const), doneAt: run?.doneAt ?? null };
  },
});
