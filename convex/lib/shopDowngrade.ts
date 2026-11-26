import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { CODES_MAX } from "./discountCodes/rules";
import { downgradeImpactOf, type DowngradeImpact } from "./downgradeImpact";
import { getEntitlements, shopProducts, visibleProductIds } from "./entitlements";
import { lookRow } from "./looks/store";
import { activeExceptions, readPlanConfig } from "./planConfig";
import { applyExceptions, resolvePlanLimits, type PlanLimits } from "./planFeatures";
import type { PlanId } from "./plans";
import { SALES_MAX } from "./sales/rules";

/**
 * What would pause if `shop` moved to `plan` (CLAUDE.md "Billing"), from
 * its real data: the downgrade dialog (`billing.downgradeImpact`) and the
 * trial reminder emails use it. `now` is passed by mutations (see
 * `getEntitlements`); queries omit it.
 */
export async function shopDowngradeImpact(
  ctx: QueryCtx,
  shop: Doc<"shops">,
  plan: PlanId,
  now?: number,
): Promise<{ impact: DowngradeImpact; current: PlanLimits; target: PlanLimits }> {
  const config = await readPlanConfig(ctx);
  const { limits: current } = await getEntitlements(ctx, shop, now);
  const target = applyExceptions(resolvePlanLimits(config, plan), await activeExceptions(ctx, shop._id, now));
  const products = await shopProducts(ctx, shop._id);
  const liveSales = await ctx.db
    .query("sales")
    .withIndex("by_shopId_and_live", (q) => q.eq("shopId", shop._id).eq("live", true))
    .take(SALES_MAX);
  const liveCodes = await ctx.db
    .query("discountCodes")
    .withIndex("by_shopId_and_live", (q) => q.eq("shopId", shop._id).eq("live", true))
    .take(CODES_MAX);
  const impact = downgradeImpactOf({
    current,
    target,
    liveSales: liveSales.length,
    liveCodes: liveCodes.length,
    visibleProducts: visibleProductIds(products, current).size,
    published: (await lookRow(ctx, shop._id))?.published ?? null,
  });
  return { impact, current, target };
}
