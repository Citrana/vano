import type { PaginationResult } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { backfill, readPlatformTotals } from "./lib/platformStats";
import { ensureBuiltInRoles } from "./lib/roles";
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
