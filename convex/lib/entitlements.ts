import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { LIMITS } from "./catalog";
import { fail, type ErrorCode } from "./errors";
import {
  PLAN_LIMITS,
  photoCap,
  productCap,
  type PlanFeatureFlag,
  type PlanId,
  type PlanLimits,
  type SubscriptionStatus,
} from "./plans";
import { effectivePlan, stateAt, subscriptionOf, type SubscriptionState } from "./subscriptions";

/**
 * "Can this shop do X?" (CLAUDE.md "Billing"): the ONE place plan limits
 * are checked. Limits come from `PLAN_LIMITS` (convex/lib/plans.ts).
 * Server functions call `requireCan`; the UI calls the pure `canShopDo`
 * with the numbers from `billing.mine` to disable buttons (the server
 * checks again).
 */

export type Entitlements = {
  /** The plan whose limits apply now (Free once a period has ended). */
  plan: PlanId;
  status: SubscriptionStatus;
  limits: PlanLimits;
  state: SubscriptionState;
};

/**
 * Mutations pass `now` so a period past its end counts as Free even before
 * the hourly expiry job ran. Queries omit it (they must not read the
 * clock) and use the stored status.
 */
export async function getEntitlements(
  ctx: QueryCtx,
  shop: Doc<"shops">,
  now?: number,
): Promise<Entitlements> {
  const stored = await subscriptionOf(ctx, shop);
  const state = now === undefined ? stored : stateAt(stored, now);
  const plan = effectivePlan(state);
  return { plan, status: state.status, limits: PLAN_LIMITS[plan], state };
}

export type PlanAction =
  /** Add one product; `products` = the shop's current count. */
  | { kind: "addProduct"; products: number }
  /** Save a product with `count` photos; `previousCount` when editing. */
  | { kind: "setPhotos"; count: number; previousCount?: number }
  /** Keep one more product visible; `pinned` = currently pinned count. */
  | { kind: "pinProduct"; pinned: number }
  | { kind: "feature"; feature: PlanFeatureFlag };

/** Null when allowed, else the error code to show. Pure. */
export function canShopDo(limits: PlanLimits, action: PlanAction): ErrorCode | null {
  switch (action.kind) {
    case "addProduct":
      // An unlimited plan is still bound by the platform ceiling, which
      // `products.create` reports as TOO_MANY_PRODUCTS.
      return limits.products !== null && action.products >= limits.products
        ? "PLAN_LIMIT_PRODUCTS"
        : null;
    case "setPhotos":
      // A product already over the limit (after a downgrade) can keep or
      // drop photos, but never gain more than the plan allows.
      return action.count > photoCap(limits, action.previousCount) ? "PLAN_LIMIT_PHOTOS" : null;
    case "pinProduct":
      return action.pinned >= productCap(limits) ? "PLAN_LIMIT_PRODUCTS" : null;
    case "feature":
      return limits.features.includes(action.feature) ? null : "PLAN_FEATURE_LOCKED";
  }
}

/** Throws the matching error code when the shop's plan doesn't allow it. */
export async function requireCan(
  ctx: MutationCtx,
  shop: Doc<"shops">,
  action: PlanAction,
): Promise<void> {
  const { limits } = await getEntitlements(ctx, shop, Date.now());
  const problem = canShopDo(limits, action);
  if (problem !== null) fail(problem);
}

/** Whether the shop's plan includes a feature (for queries; stored status). */
export async function hasFeature(
  ctx: QueryCtx,
  shop: Doc<"shops">,
  feature: PlanFeatureFlag,
): Promise<boolean> {
  const { limits } = await getEntitlements(ctx, shop);
  return canShopDo(limits, { kind: "feature", feature }) === null;
}

type VisibilityInput = Pick<Doc<"products">, "_id" | "_creationTime" | "pinnedAt" | "hidden">;

/**
 * Which products the public shop shows (CLAUDE.md "Billing"): products
 * hidden by an admin never count; then the seller's pinned products
 * (most recently pinned first), then the newest, up to the plan's limit.
 * The rest are "over the limit": kept and editable, but not public.
 * Computed on every read, so upgrading shows everything again at once.
 */
export function visibleProductIds<P extends VisibilityInput>(
  products: readonly P[],
  limits: PlanLimits,
): Set<Id<"products">> {
  const cap = productCap(limits);
  const ranked = products
    .filter((p) => !p.hidden)
    .sort((a, b) => {
      const pa = a.pinnedAt ?? -1;
      const pb = b.pinnedAt ?? -1;
      if (pa !== pb) return pb - pa;
      return b._creationTime - a._creationTime;
    });
  return new Set(ranked.slice(0, cap).map((p) => p._id));
}

/** All of the shop's products (bounded by the platform ceiling). */
export async function shopProducts(ctx: QueryCtx, shopId: Id<"shops">): Promise<Doc<"products">[]> {
  return await ctx.db
    .query("products")
    .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
    .order("desc")
    .take(LIMITS.maxProducts);
}
