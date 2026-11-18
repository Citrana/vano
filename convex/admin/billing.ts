import { filter } from "convex-helpers/server/filter";
import { paginationOptsValidator, paginationResultValidator, type PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery } from "../lib/access";
import { fail } from "../lib/errors";
import { assertNotOwnShop } from "../lib/guards";
import { currencyValidator } from "../lib/money";
import {
  grantDaysProblem,
  grantReasonProblem,
  grantablePlanValidator,
  planIdValidator,
  subscriptionSourceValidator,
  subscriptionStatusValidator,
  type PlanId,
  type SubscriptionStatus,
} from "../lib/plans";
import {
  dayOrNull,
  extendState,
  grantState,
  subscriptionDoc,
  subscriptionOf,
  writeSubscription,
} from "../lib/subscriptions";
import { paymentStatusValidator, providerIdValidator, type PaymentStatus } from "../payments/types";

/**
 * Admin subscriptions and payments (CLAUDE.md "Billing"). Reads need
 * `billing.view`; granting or extending a plan needs `billing.manage`, a
 * reason, and is never allowed on the admin's own shop. Every change is
 * logged in the same mutation.
 */

/** Far-future bound so a date range can always sit inside an index. */
const END_OF_TIME = 8.64e15;

const subscriptionRow = v.object({
  _id: v.id("subscriptions"),
  shopId: v.id("shops"),
  shopName: v.string(),
  plan: planIdValidator,
  status: subscriptionStatusValidator,
  periodEnd: v.union(v.number(), v.null()),
  source: subscriptionSourceValidator,
  updatedAt: v.number(),
});

const toSubscriptionRow = (s: Doc<"subscriptions">) => ({
  _id: s._id,
  shopId: s.shopId,
  shopName: s.shopName,
  plan: s.plan,
  status: s.status,
  periodEnd: s.periodEnd ?? null,
  source: s.source,
  updatedAt: s.updatedAt,
});

const paymentRow = v.object({
  _id: v.id("payments"),
  createdAt: v.number(),
  shopId: v.id("shops"),
  shopName: v.string(),
  plan: planIdValidator,
  amountMinor: v.number(),
  currency: currencyValidator,
  status: paymentStatusValidator,
  provider: providerIdValidator,
  providerRef: v.union(v.string(), v.null()),
  completedAt: v.union(v.number(), v.null()),
});

const toPaymentRow = (p: Doc<"payments">) => ({
  _id: p._id,
  createdAt: p._creationTime,
  shopId: p.shopId,
  shopName: p.shopName,
  plan: p.plan,
  amountMinor: p.amountMinor,
  currency: p.currency,
  status: p.status,
  provider: p.provider,
  providerRef: p.providerRef ?? null,
  completedAt: p.completedAt ?? null,
});

function pageOfSubscriptions(
  ctx: QueryCtx,
  args: {
    paginationOpts: { numItems: number; cursor: string | null };
    search?: string;
    plan?: PlanId;
    status?: SubscriptionStatus;
    endsFrom?: number;
    endsTo?: number;
  },
): Promise<PaginationResult<Doc<"subscriptions">>> {
  const { paginationOpts, plan, status } = args;
  const search = args.search?.trim();
  const hasRange = args.endsFrom !== undefined || args.endsTo !== undefined;
  const from = args.endsFrom ?? 0;
  const to = args.endsTo ?? END_OF_TIME;
  const subs = ctx.db.query("subscriptions");

  if (search) {
    const base = subs.withSearchIndex("search_shopName", (q) => {
      const s = q.search("shopName", search);
      if (plan && status) return s.eq("plan", plan).eq("status", status);
      if (plan) return s.eq("plan", plan);
      if (status) return s.eq("status", status);
      return s;
    });
    // The search index can't range on dates: filtered while paginating.
    const query = hasRange
      ? filter(base, (s) => s.periodEnd !== undefined && s.periodEnd >= from && s.periodEnd < to)
      : base;
    return query.paginate(paginationOpts);
  }
  // Soonest ending first. With a date range, Free (no end date) drops out.
  if (plan && status) {
    return subs
      .withIndex("by_plan_and_status_and_periodEnd", (q) => {
        const eq = q.eq("plan", plan).eq("status", status);
        return hasRange ? eq.gte("periodEnd", from).lt("periodEnd", to) : eq;
      })
      .paginate(paginationOpts);
  }
  if (plan) {
    return subs
      .withIndex("by_plan_and_periodEnd", (q) => {
        const eq = q.eq("plan", plan);
        return hasRange ? eq.gte("periodEnd", from).lt("periodEnd", to) : eq;
      })
      .paginate(paginationOpts);
  }
  if (status) {
    return subs
      .withIndex("by_status_and_periodEnd", (q) => {
        const eq = q.eq("status", status);
        return hasRange ? eq.gte("periodEnd", from).lt("periodEnd", to) : eq;
      })
      .paginate(paginationOpts);
  }
  return subs
    .withIndex("by_periodEnd", (q) => (hasRange ? q.gte("periodEnd", from).lt("periodEnd", to) : q))
    .paginate(paginationOpts);
}

export const subscriptions = adminQuery({
  permission: "billing.view",
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    plan: v.optional(planIdValidator),
    status: v.optional(subscriptionStatusValidator),
    endsFrom: v.optional(v.number()),
    endsTo: v.optional(v.number()),
  },
  returns: paginationResultValidator(subscriptionRow),
  handler: async (ctx, args) => {
    const result = await pageOfSubscriptions(ctx, args);
    return { ...result, page: result.page.map(toSubscriptionRow) };
  },
});

function pageOfPayments(
  ctx: QueryCtx,
  args: {
    paginationOpts: { numItems: number; cursor: string | null };
    search?: string;
    plan?: PlanId;
    status?: PaymentStatus;
    from?: number;
    to?: number;
  },
): Promise<PaginationResult<Doc<"payments">>> {
  const { paginationOpts, plan, status, from = 0, to = END_OF_TIME } = args;
  const search = args.search?.trim();
  const payments = ctx.db.query("payments");
  if (search) {
    const base = payments.withSearchIndex("search_shopName", (q) => {
      const s = q.search("shopName", search);
      if (plan && status) return s.eq("plan", plan).eq("status", status);
      if (plan) return s.eq("plan", plan);
      if (status) return s.eq("status", status);
      return s;
    });
    return filter(base, (p) => p._creationTime >= from && p._creationTime < to).paginate(paginationOpts);
  }
  // Newest first; the date range is on `_creationTime`, appended to every index.
  const query =
    plan && status
      ? payments.withIndex("by_plan_and_status", (q) =>
          q.eq("plan", plan).eq("status", status).gte("_creationTime", from).lt("_creationTime", to),
        )
      : plan
        ? payments.withIndex("by_plan", (q) => q.eq("plan", plan).gte("_creationTime", from).lt("_creationTime", to))
        : status
          ? payments.withIndex("by_status", (q) =>
              q.eq("status", status).gte("_creationTime", from).lt("_creationTime", to),
            )
          : payments.withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lt("_creationTime", to));
  return query.order("desc").paginate(paginationOpts);
}

export const payments = adminQuery({
  permission: "billing.view",
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    plan: v.optional(planIdValidator),
    status: v.optional(paymentStatusValidator),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  returns: paginationResultValidator(paymentRow),
  handler: async (ctx, args) => {
    const result = await pageOfPayments(ctx, args);
    return { ...result, page: result.page.map(toPaymentRow) };
  },
});

/** The plan panel on the admin shop page: subscription + recent payments. */
export const forShop = adminQuery({
  permission: "billing.view",
  args: { shopId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      plan: planIdValidator,
      status: subscriptionStatusValidator,
      periodStart: v.number(),
      periodEnd: v.union(v.number(), v.null()),
      source: v.union(subscriptionSourceValidator, v.null()),
      payments: v.array(paymentRow),
    }),
  ),
  handler: async (ctx, args) => {
    const shopId = ctx.db.normalizeId("shops", args.shopId);
    const shop = shopId ? await ctx.db.get("shops", shopId) : null;
    if (!shop) return null;
    const state = await subscriptionOf(ctx, shop);
    const doc = await subscriptionDoc(ctx, shop._id);
    const recent = await ctx.db
      .query("payments")
      .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
      .order("desc")
      .take(10);
    return {
      plan: state.plan,
      status: state.status,
      periodStart: state.periodStart,
      periodEnd: state.periodEnd,
      source: doc?.source ?? null,
      payments: recent.map(toPaymentRow),
    };
  },
});

function checkGrantInput(days: number, reason: string): string {
  if (grantDaysProblem(days) !== null) fail("DAYS_INVALID");
  if (grantReasonProblem(reason) !== null) fail("REASON_INVALID");
  return reason.trim();
}

/** Puts the shop on `plan` from now for `days` (e.g. a partner deal, Enterprise). */
export const grant = adminMutation({
  permission: "billing.manage",
  args: { shopId: v.id("shops"), plan: grantablePlanValidator, days: v.number(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { shopId, plan, days, reason }) => {
    const cleanReason = checkGrantInput(days, reason);
    const shop = await ctx.db.get("shops", shopId);
    if (!shop) fail("NOT_FOUND");
    assertNotOwnShop(ctx.access, shop);
    const now = Date.now();
    const current = await subscriptionOf(ctx, shop);
    await writeSubscription(ctx, shop, grantState(plan, days, now), {
      source: "admin",
      action: "subscription.grant",
      actor: ctx.user,
      details: { days, reason: cleanReason, previousPlan: current.plan, previousEnd: dayOrNull(current.periodEnd) },
    });
    return null;
  },
});

/** Adds `days` to the current trial or plan (from now if it already ended). */
export const extend = adminMutation({
  permission: "billing.manage",
  args: { shopId: v.id("shops"), days: v.number(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { shopId, days, reason }) => {
    const cleanReason = checkGrantInput(days, reason);
    const shop = await ctx.db.get("shops", shopId);
    if (!shop) fail("NOT_FOUND");
    assertNotOwnShop(ctx.access, shop);
    const now = Date.now();
    const current = await subscriptionOf(ctx, shop);
    const next = extendState(current, days, now);
    // Free has nothing to extend: grant a plan instead.
    if (next === null) fail("PLAN_INVALID");
    await writeSubscription(ctx, shop, next, {
      source: "admin",
      action: "subscription.extend",
      actor: ctx.user,
      details: { days, reason: cleanReason, previousEnd: dayOrNull(current.periodEnd) },
    });
    return null;
  },
});
