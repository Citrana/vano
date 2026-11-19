import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logAdminAction, type AuditAction } from "./audit";
import { addMonths, utcDay } from "./days";
import { notify } from "./notify";
import {
  DAY_MS,
  PERIOD_DAYS,
  PLAN_PRICE_MINOR,
  TRIAL_MONTHS,
  TRIAL_PLAN,
  type PaidPlanId,
  type PlanId,
  type SubscriptionSource,
  type SubscriptionStatus,
} from "./plans";

/**
 * Subscriptions (CLAUDE.md "Billing"). Every write to the `subscriptions`
 * table goes through this file. The pure helpers (`applyPurchase`,
 * `expireIfDue`, `effectivePlan`) hold the rules and are unit-tested.
 */

export type SubscriptionState = {
  plan: PlanId;
  status: SubscriptionStatus;
  periodStart: number;
  /** null on Free. */
  periodEnd: number | null;
};

export function trialState(now: number): SubscriptionState {
  return {
    plan: TRIAL_PLAN,
    status: "trialing",
    periodStart: now,
    periodEnd: addMonths(now, TRIAL_MONTHS),
  };
}

/** The plan whose limits apply: Free once the trial / paid plan has ended. */
export function effectivePlan(state: SubscriptionState): PlanId {
  return state.status === "trialing" || state.status === "active" ? state.plan : "free";
}

/**
 * The state after the period ended, or null when it isn't due yet (or
 * there's nothing to end). trialing → free, active → expired.
 */
export function expireIfDue(state: SubscriptionState, now: number): SubscriptionState | null {
  if (state.status !== "trialing" && state.status !== "active") return null;
  if (state.periodEnd === null || state.periodEnd > now) return null;
  return {
    plan: "free",
    status: state.status === "trialing" ? "free" : "expired",
    periodStart: state.periodEnd,
    periodEnd: null,
  };
}

/** The state as of `now`, applying an expiry the scheduled job hasn't run yet. */
export function stateAt(state: SubscriptionState, now: number): SubscriptionState {
  return expireIfDue(state, now) ?? state;
}

const PERIOD_MS = PERIOD_DAYS * DAY_MS;

/**
 * The state after a successful payment for `plan` (one period):
 * - same plan, still active: the period is added to the current end;
 * - during the trial: the plan starts now, and the remaining trial days
 *   are kept (end = trial end + one period);
 * - another plan, still active: the plan starts now for one period, plus
 *   the unused days converted at the price ratio (10 Pro days ≈ 3 Business
 *   days, 3 Business days ≈ 10 Pro days);
 * - free / expired: the plan starts now for one period.
 */
export function applyPurchase(
  current: SubscriptionState,
  plan: PaidPlanId,
  now: number,
): SubscriptionState {
  const state = stateAt(current, now);
  const remaining = state.periodEnd === null ? 0 : Math.max(0, state.periodEnd - now);

  if (state.status === "active" && state.plan === plan && state.periodEnd !== null) {
    return { ...state, periodEnd: state.periodEnd + PERIOD_MS };
  }
  if (state.status === "trialing") {
    return { plan, status: "active", periodStart: now, periodEnd: now + remaining + PERIOD_MS };
  }
  if (state.status === "active") {
    const oldPrice = PLAN_PRICE_MINOR[state.plan];
    const newPrice = PLAN_PRICE_MINOR[plan] ?? 0;
    // A custom-priced plan (Enterprise) keeps its days one for one.
    const credit =
      oldPrice === null || newPrice <= 0 ? remaining : Math.floor((remaining * oldPrice) / newPrice);
    return { plan, status: "active", periodStart: now, periodEnd: now + PERIOD_MS + credit };
  }
  return { plan, status: "active", periodStart: now, periodEnd: now + PERIOD_MS };
}

/** An admin grant: `plan` from now for `days`. */
export function grantState(plan: PlanId, days: number, now: number): SubscriptionState {
  return { plan, status: "active", periodStart: now, periodEnd: now + days * DAY_MS };
}

/** An admin extension: `days` more on the current plan (must have one). */
export function extendState(
  current: SubscriptionState,
  days: number,
  now: number,
): SubscriptionState | null {
  const state = stateAt(current, now);
  if (state.status !== "trialing" && state.status !== "active") return null;
  const end = Math.max(now, state.periodEnd ?? now);
  return { ...state, periodEnd: end + days * DAY_MS };
}

// ---------------------------------------------------------------------------
// Database helpers

export async function subscriptionDoc(
  ctx: QueryCtx,
  shopId: Id<"shops">,
): Promise<Doc<"subscriptions"> | null> {
  return await ctx.db
    .query("subscriptions")
    .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
    .unique();
}

export function stateOf(doc: Doc<"subscriptions">): SubscriptionState {
  return {
    plan: doc.plan,
    status: doc.status,
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd ?? null,
  };
}

/**
 * The shop's subscription. A shop without a row yet (created before
 * `migrations:billingV1` ran) is on a trial counted from its creation.
 */
export async function subscriptionOf(
  ctx: QueryCtx,
  shop: Doc<"shops">,
): Promise<SubscriptionState> {
  const doc = await subscriptionDoc(ctx, shop._id);
  return doc ? stateOf(doc) : trialState(shop._creationTime);
}

/** Audit details use readable UTC days for dates. */
export function dayOrNull(ms: number | null): string | null {
  return ms === null ? null : utcDay(ms);
}

/**
 * Writes the shop's subscription (insert or replace) and records the change
 * in the activity history, in the caller's transaction. `action: null` is
 * only for the initial trial: opening a shop isn't a plan change.
 */
export async function writeSubscription(
  ctx: MutationCtx,
  shop: Doc<"shops">,
  next: SubscriptionState,
  log: {
    source: SubscriptionSource;
    action: AuditAction | null;
    actor: Doc<"users"> | null;
    details?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  const existing = await subscriptionDoc(ctx, shop._id);
  const fields = {
    shopId: shop._id,
    shopName: shop.name,
    plan: next.plan,
    status: next.status,
    periodStart: next.periodStart,
    periodEnd: next.periodEnd ?? undefined,
    source: log.source,
    updatedAt: Date.now(),
  };
  if (existing) await ctx.db.replace("subscriptions", existing._id, fields);
  else await ctx.db.insert("subscriptions", fields);

  if (log.action === null) return;
  await notifyPlanChange(ctx, shop, existing?.plan ?? null, next, log.action);
  await logAdminAction(ctx, {
    actor: log.actor,
    action: log.action,
    targetType: "subscription",
    targetId: shop._id,
    targetLabel: shop.name,
    details: {
      plan: next.plan,
      periodEnd: dayOrNull(next.periodEnd),
      ...log.details,
    },
  });
}

const ACTIVATED: readonly AuditAction[] = ["subscription.activated", "subscription.grant", "subscription.extend"];

/**
 * Tells the shop's owner about a plan change (CLAUDE.md "Notifications").
 * Called only by `writeSubscription`, so every change path gets it.
 */
async function notifyPlanChange(
  ctx: MutationCtx,
  shop: Doc<"shops">,
  previousPlan: PlanId | null,
  next: SubscriptionState,
  action: AuditAction,
): Promise<void> {
  const to = { userId: shop.ownerId };
  if (ACTIVATED.includes(action) && next.periodEnd !== null) {
    await notify(ctx, {
      data: { type: "plan.activated", plan: next.plan, periodEnd: next.periodEnd },
      to,
      dedupeKey: `plan.activated:${shop._id}:${next.periodEnd}`,
    });
  } else if (action === "subscription.expired" || action === "subscription.trialEnded") {
    await notify(ctx, {
      data: { type: "plan.expired", plan: previousPlan ?? TRIAL_PLAN, trial: action === "subscription.trialEnded" },
      to,
      dedupeKey: `plan.expired:${shop._id}:${next.periodStart}`,
    });
  }
}

/** Every new shop starts on the trial (called from `shops.create`). */
export async function startTrial(
  ctx: MutationCtx,
  shop: Doc<"shops">,
  now = Date.now(),
): Promise<void> {
  await writeSubscription(ctx, shop, trialState(now), {
    source: "trial",
    action: null,
    actor: null,
  });
}
