import type { Currency } from "./money";
import {
  FEATURE_KEYS,
  featureDef,
  isLower,
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

/**
 * The plan's sign-up / buy button (CLAUDE.md "Billing"): Free = start free;
 * the trial plan (Pro) = start the free trial, no payment method; a plan
 * with a custom price (Enterprise) = talk to us; any other paid plan
 * (Business) = buy it right away, no trial.
 */
export type PlanCta = "free" | "trial" | "buy" | "talk";

export function planCta(catalog: Pick<PlanCatalog, "trialPlan" | "trialMonths">, plan: CatalogPlan): PlanCta {
  if (plan.monthlyMinor === 0) return "free";
  if (plan.monthlyMinor === null) return "talk";
  if (plan.id === catalog.trialPlan && catalog.trialMonths > 0) return "trial";
  return "buy";
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

/** A pricing card line ("Up to 10 products", "WhatsApp orders"). */
export type CardLine = { key: string; label: string; hint?: string };

/** A plan includes a feature: a flag on, an unlimited or positive limit. */
export function includedValue(value: FeatureValue): boolean {
  return value === true || value === null || (typeof value === "number" && value > 0);
}

/** The card line of a feature for a plan's value, from the admin's pricing text. */
export function cardLineFor(f: CatalogFeature, value: FeatureValue, locale: string): CardLine {
  const p = f.pricing;
  const hint = p.hint ? localizedIn(p.hint, locale) : undefined;
  let label = localizedIn(p.cardLabel, locale);
  if (f.kind === "limit") {
    label =
      value === null
        ? localizedIn(p.unlimitedLabel ?? p.cardLabel, locale).replace("{count}", "∞")
        : label.replace("{count}", String(value));
  }
  return { key: f.key, label, hint };
}

/**
 * What a plan includes, as its pricing card lines (shown, on-card
 * features only, in the admin's order). Used by the trial reminder
 * emails ("what you keep on Free").
 */
export function includedCardLines(catalog: PlanCatalog, plan: PlanId, locale: string): CardLine[] {
  return catalog.features
    .filter((f) => f.pricing.show && f.pricing.showOnCard && includedValue(f.values[plan]))
    .map((f) => cardLineFor(f, f.values[plan], locale));
}

/**
 * What moving from `from` to `to` unlocks: the card lines `to` gives more
 * of (a flag on, a higher limit), in the admin's pricing order. The
 * upgrade dialog shows the first few; the upgrade receipt email lists them.
 */
export function addedFeatures(catalog: PlanCatalog, from: PlanId, to: PlanId, locale: string): CardLine[] {
  return catalog.features
    .filter((f) => f.pricing.show && f.pricing.showOnCard)
    .filter((f) => includedValue(f.values[to]) && isLower(f.values[to], f.values[from]))
    .map((f) => cardLineFor(f, f.values[to], locale));
}
