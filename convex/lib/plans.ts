import { v, type Infer } from "convex/values";
import { LIMITS } from "./catalog";
import type { Currency } from "./money";

/**
 * Vano plans (CLAUDE.md "Billing"): the ONE source for plan ids, prices,
 * limits, the trial and plan features. Shared by the server (limit checks,
 * checkout amounts) and the UI. Marketing display data (cards, comparison
 * table) lives in `src/features/marketing/pricing/plans.ts`, which imports
 * the numbers from here.
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

/** Monthly price in minor units; null = custom price ("Talk to us"). */
export const PLAN_PRICE_MINOR: Record<PlanId, number | null> = {
  free: 0,
  pro: 29900,
  business: 100000,
  enterprise: null,
};

/** New shops get this many calendar months of `TRIAL_PLAN`, no payment needed. */
export const TRIAL_MONTHS = 2;
export const TRIAL_PLAN: PlanId = "pro";
/** One paid period. */
export const PERIOD_DAYS = 30;
/** The dashboard warns this many days before a trial or plan ends. */
export const EXPIRY_WARNING_DAYS = 7;

export const DAY_MS = 86_400_000;

/** Features switched on per plan. Enforced with `requireCan` (lib/entitlements.ts). */
export type PlanFeatureFlag =
  | "shopStats"
  | "allLooks"
  | "salesPromotions"
  | "teamRoles"
  | "discountCodes"
  | "orderTracking"
  | "multiShop";

export type PlanLimits = {
  /** null = unlimited (up to the platform ceiling `LIMITS.maxProducts`). */
  products: number | null;
  photosPerProduct: number;
  /** Extra team accounts (not built yet). */
  teamMembers: number;
  features: readonly PlanFeatureFlag[];
};

const PRO_FEATURES: readonly PlanFeatureFlag[] = ["shopStats", "allLooks", "salesPromotions"];
const BUSINESS_FEATURES: readonly PlanFeatureFlag[] = [
  ...PRO_FEATURES,
  "teamRoles",
  "discountCodes",
  "orderTracking",
];

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { products: 10, photosPerProduct: 3, teamMembers: 0, features: [] },
  pro: { products: 50, photosPerProduct: 6, teamMembers: 0, features: PRO_FEATURES },
  business: { products: null, photosPerProduct: 6, teamMembers: 5, features: BUSINESS_FEATURES },
  enterprise: {
    products: null,
    photosPerProduct: 6,
    teamMembers: 20,
    features: [...BUSINESS_FEATURES, "multiShop"],
  },
};

/** The product limit actually enforced (unlimited = platform ceiling). */
export function productCap(limits: PlanLimits): number {
  return limits.products ?? LIMITS.maxProducts;
}

/** free < pro < business < enterprise. */
export function planRank(plan: PlanId): number {
  return PLAN_IDS.indexOf(plan);
}

/**
 * trialing: trial plan until periodEnd. active: paid or admin-granted plan
 * until periodEnd. expired: a paid plan lapsed. free: the trial ended
 * without payment. expired and free both get Free limits.
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
