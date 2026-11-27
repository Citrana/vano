import { v, type Infer } from "convex/values";
import { formatMoney, type Currency } from "./money";

/**
 * Vano plans (CLAUDE.md "Billing"): plan ids, validators, statuses and the
 * fixed rules (period length, grant rules). Prices, limits, features and
 * the trial length are NOT here: they live in the `planConfig` table,
 * edited on the admin "Plans & features" page (`convex/lib/planConfig.ts`;
 * feature keys in `planFeatures.ts`, seed in `planDefaults.ts`).
 */

export const PLAN_IDS = ["free", "pro", "business", "enterprise"] as const;
export const planIdValidator = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("business"),
  v.literal("enterprise"),
);
export type PlanId = Infer<typeof planIdValidator>;

/** Plans a seller can buy at checkout. Enterprise is granted by an admin. */
export const PAID_PLAN_IDS = ["pro", "business"] as const;
export const paidPlanValidator = v.union(v.literal("pro"), v.literal("business"));
export type PaidPlanId = Infer<typeof paidPlanValidator>;

export function isPaidPlan(plan: string): plan is PaidPlanId {
  return (PAID_PLAN_IDS as readonly string[]).includes(plan);
}

/** Plans an admin can grant (any plan with paid features). */
export const grantablePlanValidator = v.union(
  v.literal("pro"),
  v.literal("business"),
  v.literal("enterprise"),
);
export type GrantablePlanId = Infer<typeof grantablePlanValidator>;

export const PLAN_CURRENCY: Currency = "KES";

/**
 * Plan prices in shillings. Uses the regional en-KE locale for English
 * ("Ksh 299"); French keeps "299 KES". Shared by the pricing pages and the
 * trial reminder emails.
 */
export function formatPlanPrice(minor: number, locale: string): string {
  return formatMoney(minor, PLAN_CURRENCY, locale === "fr" ? "fr" : "en-KE");
}

/** New shops start a free trial of this plan (its length is in `planConfig`). */
export const TRIAL_PLAN: PlanId = "pro";
/** One paid period. */
export const PERIOD_DAYS = 30;
/** The dashboard warns this many days before a trial or plan ends. */
export const EXPIRY_WARNING_DAYS = 7;
/**
 * After a trial or plan ends, the shop keeps its plan this many more days
 * (time to pay) before it moves to Free.
 */
export const GRACE_DAYS = 3;

export const DAY_MS = 86_400_000;
export const GRACE_MS = GRACE_DAYS * DAY_MS;

/** free < pro < business < enterprise. */
export function planRank(plan: PlanId): number {
  return PLAN_IDS.indexOf(plan);
}

/**
 * trialing: trial plan until periodEnd (+ grace). active: paid or
 * admin-granted plan until periodEnd (+ grace). expired: a paid plan
 * lapsed. free: the trial ended without payment, or the shop never had
 * one ("Get Business" sign-up). expired and free both get Free limits.
 */
export const SUBSCRIPTION_STATUSES = ["trialing", "active", "expired", "free"] as const;
export const subscriptionStatusValidator = v.union(
  v.literal("trialing"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("free"),
);
export type SubscriptionStatus = Infer<typeof subscriptionStatusValidator>;

export const subscriptionSourceValidator = v.union(
  v.literal("trial"),
  v.literal("payment"),
  v.literal("admin"),
  v.literal("system"),
);
export type SubscriptionSource = Infer<typeof subscriptionSourceValidator>;

/** Admin grants: a reason is always required. */
export const GRANT_REASON_MIN = 5;
export const GRANT_REASON_MAX = 500;
export const GRANT_DAYS_MIN = 1;
export const GRANT_DAYS_MAX = 366;

export function grantReasonProblem(reason: string): "length" | null {
  const length = reason.trim().length;
  return length < GRANT_REASON_MIN || length > GRANT_REASON_MAX ? "length" : null;
}

export function grantDaysProblem(days: number): "range" | null {
  return Number.isInteger(days) && days >= GRANT_DAYS_MIN && days <= GRANT_DAYS_MAX ? null : "range";
}

/** Whole days left until `end` (rounded up; 0 once it has passed). */
export function daysLeft(end: number, now: number): number {
  return Math.max(0, Math.ceil((end - now) / DAY_MS));
}

/**
 * A lower plan the seller chose (`planChanges`, docs/payments.md section 15):
 * scheduled until the plan ends, kept ("Keep my plan") or replaced by
 * another choice.
 */
export const planChangeStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("kept"),
  v.literal("replaced"),
);
export type PlanChangeStatus = Infer<typeof planChangeStatusValidator>;
