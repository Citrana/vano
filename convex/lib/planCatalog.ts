import type { Currency } from "./money";
import {
  FEATURE_KEYS,
  featureDef,
  resolvedValue,
  type FeatureKey,
  type FeaturePricing,
  type FeatureValue,
  type Localized,
  type PlanArea,
  type PlanConfigData,
} from "./planFeatures";
import { PLAN_CURRENCY, PLAN_IDS, TRIAL_PLAN, type PlanId } from "./plans";

/**
 * The public view of the plan configuration (`plans.catalog`): what the
 * pricing page, the plan comparison, the seller's plan options and the
 * "Available on <plan>" notes read. Values are resolved (a plan includes
 * everything in the lower ones). Pure, so the pricing derivations can be
 * tested with the seed.
 */

export type CatalogPlan = {
  id: PlanId;
  name: Localized;
  monthlyMinor: number | null;
  yearlyMinor: number | null;
  visible: boolean;
};

export type CatalogFeature = {
  key: FeatureKey;
  kind: "flag" | "limit";
  area: PlanArea;
  enforced: boolean;
  values: Record<PlanId, FeatureValue>;
  pricing: FeaturePricing;
};

export type PlanCatalog = {
  currency: Currency;
  trialPlan: PlanId;
  trialMonths: number;
  /** Every plan in rank order (hidden ones too, flagged `visible: false`). */
  plans: CatalogPlan[];
  /** Every feature, by pricing order. */
  features: CatalogFeature[];
};

export function catalogOf(config: PlanConfigData): PlanCatalog {
  const features = FEATURE_KEYS.map((key) => ({
    key,
    kind: featureDef(key).kind,
    area: featureDef(key).area,
    enforced: featureDef(key).enforced,
    values: Object.fromEntries(PLAN_IDS.map((id) => [id, resolvedValue(config, key, id)])) as Record<PlanId, FeatureValue>,
    pricing: config.features[key].pricing,
  })).sort((a, b) => a.pricing.order - b.pricing.order);
  return {
    currency: PLAN_CURRENCY,
    trialPlan: TRIAL_PLAN,
    trialMonths: config.plans[TRIAL_PLAN].trialMonths,
    plans: PLAN_IDS.map((id) => {
      const p = config.plans[id];
      return { id, name: p.name, monthlyMinor: p.monthlyMinor, yearlyMinor: p.yearlyMinor, visible: p.visible };
    }),
    features,
  };
}

/** The plan's name in a language (`fr` or anything else = English). */
export function planNameIn(catalog: Pick<PlanCatalog, "plans">, id: PlanId, locale: string): string {
  const plan = catalog.plans.find((p) => p.id === id);
  if (!plan) return id;
  return locale === "fr" ? plan.name.fr : plan.name.en;
}

/** The cheapest plan that includes a flag ("Available on <plan>"). */
export function lowestPlanFor(catalog: PlanCatalog, key: FeatureKey): PlanId | null {
  const feature = catalog.features.find((f) => f.key === key);
  if (!feature) return null;
  return PLAN_IDS.find((id) => feature.values[id] === true) ?? null;
}

export function localizedIn(text: Localized, locale: string): string {
  return locale === "fr" ? text.fr : text.en;
}
