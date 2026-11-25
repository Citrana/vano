import { isFreeLook } from "./looks/presets";
import { isFreeSections } from "./looks/sections";
import { withoutPromo } from "./looks/clean";
import type { StoredLook } from "./looks/validators";
import { productCap, type FeatureFlag, type PlanLimits } from "./planFeatures";

/**
 * What would pause if a shop moved from its current limits to a lower
 * plan's (CLAUDE.md "Billing": the downgrade dialog). Pure: the caller
 * passes the shop's real counts. Nothing is ever deleted — these parts
 * just stop showing or working until the shop upgrades again.
 */

export type DowngradeImpact = {
  /** Running sales that would stop (normal prices return). */
  sales: number;
  /** Live discount codes that would stop working. */
  discountCodes: number;
  /** Products visitors see now that would be hidden (over the new limit). */
  productsHidden: number;
  /** The published custom look would show as the free look. */
  look: boolean;
  /** The published sections / layout would show the free layout. */
  sections: boolean;
  /** The published event banner would stop showing. */
  eventBanner: boolean;
  /** The Promo bar would stop showing. */
  promoBar: boolean;
};

export type DowngradeInput = {
  current: PlanLimits;
  target: PlanLimits;
  liveSales: number;
  liveCodes: number;
  /** Products visitors see now (not hidden, inside the current limit). */
  visibleProducts: number;
  published: StoredLook | null;
};

const has = (limits: PlanLimits, feature: FeatureFlag) => limits.features.includes(feature);
/** A feature the shop has now and the target plan doesn't. */
const loses = (input: DowngradeInput, feature: FeatureFlag) => has(input.current, feature) && !has(input.target, feature);

export function downgradeImpactOf(input: DowngradeInput): DowngradeImpact {
  const { published } = input;
  return {
    sales: loses(input, "salesPromotions") ? input.liveSales : 0,
    discountCodes: loses(input, "discountCodes") ? input.liveCodes : 0,
    productsHidden: Math.max(0, input.visibleProducts - productCap(input.target)),
    look: loses(input, "allLooks") && published !== null && !isFreeLook(withoutPromo(published)),
    sections: loses(input, "featuredSections") && published !== null && !isFreeSections(published.overrides.sections),
    eventBanner: loses(input, "salesPromotions") && published?.overrides.promo !== undefined,
    promoBar: loses(input, "announcementBar") && published?.overrides.announcement !== undefined,
  };
}

/** Whether anything at all would pause. */
export function hasImpact(impact: DowngradeImpact): boolean {
  return Object.values(impact).some((v) => v === true || (typeof v === "number" && v > 0));
}
