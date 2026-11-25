import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { LIMITS } from "./catalog";
import { fail, type ErrorCode } from "./errors";
import { activeExceptions, readPlanConfig } from "./planConfig";
import {
  applyExceptions,
  photoCap,
  productCap,
  resolvePlanLimits,
  type FeatureFlag,
  type PlanLimits,
} from "./planFeatures";
import type { PlanId, SubscriptionStatus } from "./plans";
import { effectivePlan, stateAt, subscriptionOf, type SubscriptionState } from "./subscriptions";

/**
 * "Can this shop do X?" / "What is this shop's limit for Y?" (CLAUDE.md
 * "Billing"): the ONE place plan limits are checked. Limits come from the
 * live plan configuration (`planConfig`, edited on the admin "Plans &
 * features" page): the shop's effective plan, including what it inherits
 * from lower plans, then the shop's exceptions on top. Server functions
 * call `requireCan` / `hasFeature`; the UI calls the pure `canShopDo` with
 * the resolved `limits` from `billing.mine` (the server checks again).
 * Queries read the config and exceptions, so open screens update live.
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
  const config = await readPlanConfig(ctx);
  const stored = await subscriptionOf(ctx, shop, config);
  const state = now === undefined ? stored : stateAt(stored, now);
  const plan = effectivePlan(state);
  const limits = applyExceptions(resolvePlanLimits(config, plan), await activeExceptions(ctx, shop._id, now));
  return { plan, status: state.status, limits, state };
}

export type PlanAction =
  /** Add one product; `products` = the shop's current count. */
  | { kind: "addProduct"; products: number }
  /** Save a product with `count` photos; `previousCount` when editing. */
  | { kind: "setPhotos"; count: number; previousCount?: number }
  /** Keep one more product visible; `pinned` = currently pinned count. */
  | { kind: "pinProduct"; pinned: number }
  | { kind: "feature"; feature: FeatureFlag };

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
  feature: FeatureFlag,
): Promise<boolean> {
  const { limits } = await getEntitlements(ctx, shop);
  return canShopDo(limits, { kind: "feature", feature }) === null;
}

/**
 * Whether a product is kept off the shop: hidden by an admin (`hidden`,
 * the seller can't undo it) or by its seller (`hiddenBySeller`). Every
 * customer-facing check uses this; admin screens read `hidden` itself.
 */
export function hiddenFromShop(product: Pick<Doc<"products">, "hidden" | "hiddenBySeller">): boolean {
  return product.hidden === true || product.hiddenBySeller === true;
}

type VisibilityInput = Pick<Doc<"products">, "_id" | "_creationTime" | "pinnedAt" | "hidden" | "hiddenBySeller">;

/**
 * Which products the public shop shows (CLAUDE.md "Billing"): products
 * hidden by an admin or their seller never count; then the seller's pinned products
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
    .filter((p) => !hiddenFromShop(p))
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
