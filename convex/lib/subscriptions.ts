import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logAdminAction, type AuditAction } from "./audit";
import { addMonths, utcDay } from "./days";
import { notify } from "./notify";
import { readPlanConfig } from "./planConfig";
import type { PlanConfigData } from "./planFeatures";
import {
  DAY_MS,
  GRACE_MS,
  PERIOD_DAYS,
  TRIAL_PLAN,
  planRank,
  type PaidPlanId,
  type PlanId,
  type SubscriptionSource,
  type SubscriptionStatus,
} from "./plans";

/**
 * Subscriptions (CLAUDE.md "Billing"). Every write to the `subscriptions`
 * table goes through this file. The pure helpers (`quotePurchase`,
 * `applyPurchase`, `expireIfDue`, `effectivePlan`) hold the rules and are
 * unit-tested; the plan dialogs, `billing.startCheckout` (the amount) and
 * `payments/core.applyEvent` (the new period) all call them.
 */

export type SubscriptionState = {
  plan: PlanId;
  status: SubscriptionStatus;
  periodStart: number;
  /** null on Free. */
  periodEnd: number | null;
  /**
   * The days actually paid for, inside the period (trial and admin-granted
   * days never count). Only used for the upgrade credit. Absent = none.
   */
  paidStart?: number | null;
  paidEnd?: number | null;
};

/** The trial length comes from the plan config (`trialMonths` of TRIAL_PLAN). */
export function trialState(now: number, months: number): SubscriptionState {
  return {
    plan: TRIAL_PLAN,
    status: "trialing",
    periodStart: now,
    periodEnd: addMonths(now, months),
  };
}

/** A shop with no trial ("Get Business" sign-up): Free until it pays. */
export function freeState(now: number): SubscriptionState {
  return { plan: "free", status: "free", periodStart: now, periodEnd: null };
}

export function trialMonthsOf(config: PlanConfigData): number {
  return config.plans[TRIAL_PLAN].trialMonths;
}

/** Monthly prices from the plan config (null = custom price). */
export type PlanPrices = Record<PlanId, number | null>;

export function pricesOf(config: PlanConfigData): PlanPrices {
  return {
    free: config.plans.free.monthlyMinor,
    pro: config.plans.pro.monthlyMinor,
    business: config.plans.business.monthlyMinor,
    enterprise: config.plans.enterprise.monthlyMinor,
  };
}

function running(state: SubscriptionState): boolean {
  return state.status === "trialing" || state.status === "active";
}

/**
 * The plan whose limits apply: the trial / paid plan until its end plus
 * the grace days (`stateAt` / the expiry job move it to Free after that),
 * else Free.
 */
export function effectivePlan(state: SubscriptionState): PlanId {
  return running(state) ? state.plan : "free";
}

/** When the shop moves to Free (period end + grace); null when nothing ends. */
export function graceEndOf(state: SubscriptionState): number | null {
  return running(state) && state.periodEnd !== null ? state.periodEnd + GRACE_MS : null;
}

/** The period has ended but the grace days haven't: time to pay. */
export function inGrace(state: SubscriptionState, now: number): boolean {
  const graceEnd = graceEndOf(state);
  return graceEnd !== null && state.periodEnd !== null && state.periodEnd <= now && now < graceEnd;
}

/**
 * The state once the period and its grace days are over, or null when it
 * isn't due yet (or there's nothing to end). trialing → free, active →
 * expired. Data is never touched.
 */
export function expireIfDue(state: SubscriptionState, now: number): SubscriptionState | null {
  const graceEnd = graceEndOf(state);
  if (graceEnd === null || graceEnd > now) return null;
  return {
    plan: "free",
    status: state.status === "trialing" ? "free" : "expired",
    periodStart: graceEnd,
    periodEnd: null,
  };
}

/** The state as of `now`, applying an expiry the scheduled job hasn't run yet. */
export function stateAt(state: SubscriptionState, now: number): SubscriptionState {
  return expireIfDue(state, now) ?? state;
}

const PERIOD_MS = PERIOD_DAYS * DAY_MS;

/**
 * Whole paid days left on an active plan, never more than one period:
 * only the paid window counts (trial and admin days never do), from now
 * or from where the paid days start, to where they (or the period) end.
 */
export function paidDaysLeft(state: SubscriptionState, now: number): number {
  if (state.status !== "active" || state.periodEnd === null) return 0;
  if (state.paidStart == null || state.paidEnd == null) return 0;
  const end = Math.min(state.paidEnd, state.periodEnd);
  const start = Math.max(now, state.paidStart);
  return Math.min(PERIOD_DAYS, Math.max(0, Math.floor((end - start) / DAY_MS)));
}

/**
 * The money credit when an active paid plan moves up (Pro → Business):
 * round(old monthly price × paid days left / 30), in whole units of the
 * currency (10 Pro days at 299 → 100). Capped so at least one unit is
 * still paid. 0 for anything else.
 */
export function upgradeCreditMinor(
  state: SubscriptionState,
  plan: PaidPlanId,
  now: number,
  prices: PlanPrices,
): number {
  if (state.status !== "active" || planRank(plan) <= planRank(state.plan)) return 0;
  const oldPrice = prices[state.plan];
  const newPrice = prices[plan];
  if (oldPrice === null || oldPrice <= 0 || newPrice === null || newPrice <= 0) return 0;
  const days = paidDaysLeft(state, now);
  const credit = Math.round(((oldPrice / 100) * days) / PERIOD_DAYS) * 100;
  return Math.max(0, Math.min(credit, newPrice - 100));
}

/** What a seller choosing `target` is doing, from where they are now. */
export type PlanChangeKind = "current" | "upgrade" | "renew" | "downgrade";

export function planChangeKind(current: SubscriptionState, target: PlanId, now: number): PlanChangeKind {
  const state = stateAt(current, now);
  const from = effectivePlan(state);
  if (target === "free") return from === "free" ? "current" : "downgrade";
  if (!running(state)) return "upgrade";
  if (target === state.plan) return "renew";
  return planRank(target) > planRank(state.plan) ? "upgrade" : "downgrade";
}

export type PurchaseQuote = {
  kind: Exclude<PlanChangeKind, "current">;
  /** What the seller pays now (0 for a downgrade: nothing is charged). */
  amountMinor: number;
  creditMinor: number;
  /** The state after paying (unchanged for a downgrade). */
  next: SubscriptionState;
};

/**
 * The price and the new period for buying one period of `plan`:
 * - same plan (renew, also during the Pro trial or the grace days): 30
 *   days after the current end, full price. During the trial the paid days
 *   start when it ends;
 * - a higher plan, or from Free / expired: starts today for 30 days; the
 *   trial ends (its days are lost); an active paid lower plan gives a money
 *   credit for its paid days left (`upgradeCreditMinor`);
 * - a lower plan while one runs (downgrade): nothing is charged and
 *   nothing changes now; the current plan runs to its end.
 */
export function quotePurchase(
  current: SubscriptionState,
  plan: PaidPlanId,
  now: number,
  prices: PlanPrices,
): PurchaseQuote {
  const state = stateAt(current, now);
  const price = prices[plan] ?? 0;
  const kind = planChangeKind(state, plan, now);
  if (kind === "downgrade" || kind === "current") {
    return { kind: "downgrade", amountMinor: 0, creditMinor: 0, next: state };
  }
  if (kind === "renew" && state.periodEnd !== null) {
    const end = state.periodEnd;
    const contiguous = state.status === "active" && state.paidEnd != null && state.paidStart != null && state.paidEnd >= end;
    return {
      kind,
      amountMinor: price,
      creditMinor: 0,
      next: {
        plan,
        status: "active",
        periodStart: state.status === "trialing" ? now : state.periodStart,
        periodEnd: end + PERIOD_MS,
        paidStart: contiguous ? state.paidStart : end,
        paidEnd: end + PERIOD_MS,
      },
    };
  }
  const creditMinor = upgradeCreditMinor(state, plan, now, prices);
  return {
    kind: "upgrade",
    amountMinor: price - creditMinor,
    creditMinor,
    next: { plan, status: "active", periodStart: now, periodEnd: now + PERIOD_MS, paidStart: now, paidEnd: now + PERIOD_MS },
  };
}

/**
 * The state after a successful payment for `plan` (`quotePurchase`). A
 * payment never buys nothing: if the shop moved to a higher plan while it
 * was pending (a downgrade by the time it lands), the current plan gets
 * the 30 days instead.
 */
export function applyPurchase(
  current: SubscriptionState,
  plan: PaidPlanId,
  now: number,
  prices: PlanPrices,
): SubscriptionState {
  const quote = quotePurchase(current, plan, now, prices);
  if (quote.kind !== "downgrade") return quote.next;
  const state = quote.next;
  const end = Math.max(now, state.periodEnd ?? now);
  return { ...state, periodEnd: end + PERIOD_MS };
}

/** An admin grant: `plan` from now for `days` (not paid days). */
export function grantState(plan: PlanId, days: number, now: number): SubscriptionState {
  return { plan, status: "active", periodStart: now, periodEnd: now + days * DAY_MS };
}

/** An admin extension: `days` more on the current plan (must have one); paid days are kept as they were. */
export function extendState(
  current: SubscriptionState,
  days: number,
  now: number,
): SubscriptionState | null {
  const state = stateAt(current, now);
  if (!running(state)) return null;
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

/**
 * Rows written before the paid window was stored: a paid plan's last 30
 * days are its paid days (the credit never counts more than 30 anyway).
 */
export function stateOf(doc: Doc<"subscriptions">): SubscriptionState {
  const periodEnd = doc.periodEnd ?? null;
  const legacyPaid = doc.paidEnd === undefined && doc.source === "payment" && periodEnd !== null;
  return {
    plan: doc.plan,
    status: doc.status,
    periodStart: doc.periodStart,
    periodEnd,
    paidStart: legacyPaid ? periodEnd - PERIOD_MS : (doc.paidStart ?? null),
    paidEnd: legacyPaid ? periodEnd : (doc.paidEnd ?? null),
  };
}

/**
 * The shop's subscription. A shop without a row yet (created before
 * `migrations:billingV1` ran) is on a trial counted from its creation.
 */
export async function subscriptionOf(
  ctx: QueryCtx,
  shop: Doc<"shops">,
  config?: PlanConfigData,
): Promise<SubscriptionState> {
  const doc = await subscriptionDoc(ctx, shop._id);
  if (doc) return stateOf(doc);
  return trialState(shop._creationTime, trialMonthsOf(config ?? (await readPlanConfig(ctx))));
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
    paidStart: next.paidStart ?? undefined,
    paidEnd: next.paidEnd ?? undefined,
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

/**
 * A new shop starts on the trial (called from `shops.create`); its length
 * is read from the plan config. A "Get Business" sign-up starts on Free
 * instead (`startFree`) and pays for Business right away.
 */
export async function startTrial(
  ctx: MutationCtx,
  shop: Doc<"shops">,
  now = Date.now(),
): Promise<void> {
  const months = trialMonthsOf(await readPlanConfig(ctx));
  await writeSubscription(ctx, shop, trialState(now, months), {
    source: "trial",
    action: null,
    actor: null,
  });
}

/** A new shop with no trial ("Get Business" sign-up): Free until it pays. */
export async function startFree(
  ctx: MutationCtx,
  shop: Doc<"shops">,
  now = Date.now(),
): Promise<void> {
  await writeSubscription(ctx, shop, freeState(now), {
    source: "system",
    action: null,
    actor: null,
  });
}
