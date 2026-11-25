import { LIMITS } from "./catalog";
import { PLAN_IDS, TRIAL_PLAN, planRank, type PlanId } from "./plans";

/**
 * The plan feature catalogue (CLAUDE.md "Billing"). The KEYS live here in
 * code because code enforces them; admins only decide which plan gets
 * which feature and the limits (`planConfig`, edited on the admin "Plans &
 * features" page). Pure: shared by the server, the seller UI and the
 * pricing page.
 *
 * - `flag`: on / off per plan. `limit`: a number per plan (`null` =
 *   unlimited, only where `unlimited` is true), capped at `max`.
 * - `enforced: false` = not built yet: shown on the pricing page only, no
 *   check in the app. Turning such a feature on changes marketing only.
 * - A higher plan always includes everything in the lower ones
 *   (free < pro < business < enterprise): `resolvedValue`.
 *
 * Adding a feature: an entry here, a default in `planDefaults.ts`, both
 * translations (`PlanFeatures.<key>`), and for an enforced one its check
 * (`requireCan` / `hasFeature`).
 */

export const PLAN_AREAS = ["products", "shopLook", "sales", "team", "support"] as const;
export type PlanArea = (typeof PLAN_AREAS)[number];

type FeatureDef =
  | { kind: "flag"; area: PlanArea; enforced: boolean }
  | { kind: "limit"; area: PlanArea; enforced: boolean; max: number; unlimited: boolean };

export const FEATURES = {
  // Products
  products: { kind: "limit", area: "products", enforced: true, max: LIMITS.maxProducts, unlimited: true },
  photosPerProduct: { kind: "limit", area: "products", enforced: true, max: LIMITS.maxImages, unlimited: false },
  categoriesSizesColors: { kind: "flag", area: "products", enforced: false },
  stockLabels: { kind: "flag", area: "products", enforced: false },
  stockManagement: { kind: "flag", area: "products", enforced: false },
  bulkUpload: { kind: "flag", area: "products", enforced: false },
  // Shop look
  shopLink: { kind: "flag", area: "shopLook", enforced: false },
  allLooks: { kind: "flag", area: "shopLook", enforced: true },
  colorsLogoBanner: { kind: "flag", area: "shopLook", enforced: false },
  featuredSections: { kind: "flag", area: "shopLook", enforced: true },
  announcementBar: { kind: "flag", area: "shopLook", enforced: true },
  shopFilters: { kind: "flag", area: "shopLook", enforced: true },
  customDomain: { kind: "flag", area: "shopLook", enforced: false },
  customBranding: { kind: "flag", area: "shopLook", enforced: false },
  // Sales
  whatsappOrders: { kind: "flag", area: "sales", enforced: false },
  salesPromotions: { kind: "flag", area: "sales", enforced: true },
  qrShareImages: { kind: "flag", area: "sales", enforced: false },
  discountCodes: { kind: "flag", area: "sales", enforced: true },
  orderTracking: { kind: "flag", area: "sales", enforced: true },
  customerList: { kind: "flag", area: "sales", enforced: false },
  shopStats: { kind: "flag", area: "sales", enforced: true },
  salesReports: { kind: "flag", area: "sales", enforced: true },
  advancedStats: { kind: "flag", area: "sales", enforced: false },
  // Team
  teamMembers: { kind: "limit", area: "team", enforced: true, max: 100, unlimited: false },
  teamRoles: { kind: "flag", area: "team", enforced: true },
  multiShop: { kind: "flag", area: "team", enforced: true },
  customIntegrations: { kind: "flag", area: "team", enforced: false },
  // Support
  prioritySupport: { kind: "flag", area: "support", enforced: false },
  dedicatedSupport: { kind: "flag", area: "support", enforced: false },
  personalizedSetup: { kind: "flag", area: "support", enforced: false },
  serviceGuarantees: { kind: "flag", area: "support", enforced: false },
} as const satisfies Record<string, FeatureDef>;

type Features = typeof FEATURES;
export type FeatureKey = keyof Features;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

/** Flags the app checks (`requireCan({ kind: "feature" })`, `hasFeature`). */
export type FeatureFlag = {
  [K in FeatureKey]: Features[K] extends { kind: "flag"; enforced: true } ? K : never;
}[FeatureKey];
export const FEATURE_FLAGS = FEATURE_KEYS.filter(
  (k) => FEATURES[k].kind === "flag" && FEATURES[k].enforced,
) as FeatureFlag[];

export function featureDef(key: FeatureKey): FeatureDef {
  return FEATURES[key];
}

export function isFeatureKey(value: string): value is FeatureKey {
  return Object.hasOwn(FEATURES, value);
}

/** Features a shop exception can grant (the ones the app checks). */
export function isExceptionFeature(key: FeatureKey): boolean {
  return FEATURES[key].enforced;
}

// ---------------------------------------------------------------------------
// Config shapes (stored in `planConfig`, seeded from `planDefaults.ts`)

export type Localized = { en: string; fr: string };

/** true / false for a flag; a number or null (unlimited) for a limit. */
export type FeatureValue = boolean | number | null;

export type PlanSettings = {
  name: Localized;
  /** Minor units per month; null = custom price ("Talk to us"). */
  monthlyMinor: number | null;
  /** Minor units per year; null = no yearly price. */
  yearlyMinor: number | null;
  /** Calendar months of free trial for new shops (only the trial plan). */
  trialMonths: number;
  /** Listed on the pricing page and in the seller's plan options. */
  visible: boolean;
};

/** Pricing-page text, separate from the real feature. */
export type FeaturePricing = {
  show: boolean;
  showOnCard: boolean;
  /** Lower first (cards, and rows inside an area of the comparison). */
  order: number;
  /** Comparison table row. */
  label: Localized;
  /** Card line; for a limit, `{count}` is replaced by the number. */
  cardLabel: Localized;
  /** Card line for an unlimited limit. */
  unlimitedLabel?: Localized;
  /** Card line on the first plan when this flag is off there. */
  offLabel?: Localized;
  /** Small muted line under the label (card and table). */
  hint?: Localized;
};

export type FeatureSettings = { values: Record<PlanId, FeatureValue>; pricing: FeaturePricing };

export type PlanConfigData = {
  plans: Record<PlanId, PlanSettings>;
  features: Record<FeatureKey, FeatureSettings>;
};

// ---------------------------------------------------------------------------
// Resolving

/** The better of two values (flag: either on; limit: unlimited or higher). */
export function betterValue(a: FeatureValue, b: FeatureValue): FeatureValue {
  if (typeof a === "boolean" || typeof b === "boolean") return a === true || b === true;
  if (a === null || b === null) return null;
  return Math.max(a, b);
}

/** True when `after` gives less than `before` (a flag off, a lower limit). */
export function isLower(before: FeatureValue, after: FeatureValue): boolean {
  if (typeof before === "boolean" || typeof after === "boolean") return before === true && after !== true;
  if (before === null) return after !== null;
  if (after === null) return false;
  return after < before;
}

/** A plan's value including what it inherits from every lower plan. */
export function resolvedValue(config: PlanConfigData, key: FeatureKey, plan: PlanId): FeatureValue {
  const values = config.features[key].values;
  let out = values[PLAN_IDS[0]];
  for (const id of PLAN_IDS.slice(1, planRank(plan) + 1)) out = betterValue(out, values[id]);
  return out;
}

/** The lower plan a value comes from, when the plan's own value is lower. */
export function inheritedFrom(config: PlanConfigData, key: FeatureKey, plan: PlanId): PlanId | null {
  const own = config.features[key].values[plan];
  const resolved = resolvedValue(config, key, plan);
  if (!isLower(resolved, own)) return null;
  for (const id of PLAN_IDS.slice(0, planRank(plan))) {
    if (!isLower(resolved, resolvedValue(config, key, id))) return id;
  }
  return null;
}

/**
 * Features `to` gives more of than `from` (a flag on, a higher limit),
 * inheritance included, in catalogue key order. E.g. `pro → business` =
 * the Business-only features (which the Pro trial never includes).
 */
export function gainedFeatures(config: PlanConfigData, from: PlanId, to: PlanId): FeatureKey[] {
  return FEATURE_KEYS.filter((key) => isLower(resolvedValue(config, key, to), resolvedValue(config, key, from)));
}

/** The cheapest plan that includes a flag (for "Available on <plan>"). */
export function lowestPlanWith(config: PlanConfigData, key: FeatureKey): PlanId | null {
  return PLAN_IDS.find((id) => resolvedValue(config, key, id) === true) ?? null;
}

/** A copy of the config with one feature value changed. */
export function withFeatureValue(
  config: PlanConfigData,
  key: FeatureKey,
  plan: PlanId,
  value: FeatureValue,
): PlanConfigData {
  const feature = config.features[key];
  return {
    ...config,
    features: { ...config.features, [key]: { ...feature, values: { ...feature.values, [plan]: value } } },
  };
}

export type LoweredFeature = { feature: FeatureKey; plan: PlanId };

/**
 * What a change takes away: every (feature, plan) whose resolved value is
 * lower after it (inheritance included, so turning a flag off on Pro can
 * also lower Business when Business only had it through Pro).
 */
export function loweredFeatures(before: PlanConfigData, after: PlanConfigData): LoweredFeature[] {
  return FEATURE_KEYS.flatMap((feature) =>
    PLAN_IDS.filter((plan) => isLower(resolvedValue(before, feature, plan), resolvedValue(after, feature, plan))).map(
      (plan) => ({ feature, plan }),
    ),
  );
}

/** Stored-value labels for the activity history (null limit = "unlimited"). */
export function valueLabel(value: FeatureValue): string | number | boolean {
  return value === null ? "unlimited" : value;
}

/** Turns raw limits from a query back into `PlanLimits` (unknown keys dropped). */
export function toPlanLimits(raw: {
  products: number | null;
  photosPerProduct: number;
  teamMembers: number;
  features: readonly string[];
}): PlanLimits {
  return { ...raw, features: FEATURE_FLAGS.filter((f) => raw.features.includes(f)) };
}

/** What the app enforces for a shop (same shape the checks always used). */
export type PlanLimits = {
  /** null = unlimited (up to the platform ceiling `LIMITS.maxProducts`). */
  products: number | null;
  photosPerProduct: number;
  /** Extra team accounts (not built yet). */
  teamMembers: number;
  features: readonly FeatureFlag[];
};

const asNumber = (value: FeatureValue, fallback: number): number =>
  typeof value === "number" ? value : fallback;

function limitsFrom(value: (key: FeatureKey) => FeatureValue): PlanLimits {
  const products = value("products");
  return {
    products: typeof products === "number" ? products : null,
    photosPerProduct: asNumber(value("photosPerProduct"), LIMITS.maxImages),
    teamMembers: asNumber(value("teamMembers"), 0),
    features: FEATURE_FLAGS.filter((f) => value(f) === true),
  };
}

export function resolvePlanLimits(config: PlanConfigData, plan: PlanId): PlanLimits {
  return limitsFrom((key) => resolvedValue(config, key, plan));
}

export type ExceptionGrant = { feature: FeatureKey; value: FeatureValue };

/** Shop exceptions win: a flag turns on, a limit rises (never lowers). */
export function applyExceptions(limits: PlanLimits, grants: readonly ExceptionGrant[]): PlanLimits {
  if (grants.length === 0) return limits;
  const current = (key: FeatureKey): FeatureValue => {
    if (key === "products") return limits.products;
    if (key === "photosPerProduct") return limits.photosPerProduct;
    if (key === "teamMembers") return limits.teamMembers;
    return (limits.features as readonly string[]).includes(key);
  };
  return limitsFrom((key) =>
    grants.reduce((value, g) => (g.feature === key ? betterValue(value, g.value) : value), current(key)),
  );
}

/** The product limit actually enforced (unlimited = platform ceiling). */
export function productCap(limits: PlanLimits): number {
  return limits.products ?? LIMITS.maxProducts;
}

/**
 * Photos allowed on a product: the plan's number, or — for a product that
 * already had more before a downgrade — what it has (it can keep them,
 * never gain more).
 */
export function photoCap(limits: PlanLimits, previousCount = 0): number {
  return Math.max(limits.photosPerProduct, previousCount);
}

// ---------------------------------------------------------------------------
// Validation (the admin form and the server use the same rules)

export const PLAN_NAME_MAX = 40;
export const PRICING_LABEL_MAX = 160;
export const TRIAL_MONTHS_MIN = 1;
export const TRIAL_MONTHS_MAX = 12;
/** Highest plan price an admin can set (minor units). */
export const PLAN_PRICE_MAX_MINOR = 100_000_000;
export const FEATURE_ORDER_MAX = 999;

export type PlanProblem =
  | "name"
  | "monthlyPrice"
  | "yearlyPrice"
  | "trialMonths"
  | "noVisiblePlan";

const textOk = (text: string, max: number) => {
  const length = text.trim().length;
  return length >= 1 && length <= max;
};
const localizedOk = (text: Localized | undefined, max: number) =>
  text === undefined || (textOk(text.en, max) && textOk(text.fr, max));
const priceOk = (minor: number) => Number.isInteger(minor) && minor >= 0 && minor <= PLAN_PRICE_MAX_MINOR;

/** Plans a seller buys at checkout need a price; Free is always 0. */
export function planSettingsProblem(plan: PlanId, s: PlanSettings): PlanProblem | null {
  if (!localizedOk(s.name, PLAN_NAME_MAX)) return "name";
  if (plan === "free") {
    if (s.monthlyMinor !== 0) return "monthlyPrice";
  } else if (plan === "pro" || plan === "business") {
    if (s.monthlyMinor === null || !priceOk(s.monthlyMinor) || s.monthlyMinor === 0) return "monthlyPrice";
  } else if (s.monthlyMinor !== null && (!priceOk(s.monthlyMinor) || s.monthlyMinor === 0)) {
    return "monthlyPrice";
  }
  if (s.yearlyMinor !== null) {
    if (s.monthlyMinor === null || s.monthlyMinor === 0) return "yearlyPrice";
    if (!priceOk(s.yearlyMinor) || s.yearlyMinor === 0 || s.yearlyMinor > s.monthlyMinor * 12) return "yearlyPrice";
  }
  if (plan === TRIAL_PLAN) {
    if (!Number.isInteger(s.trialMonths) || s.trialMonths < TRIAL_MONTHS_MIN || s.trialMonths > TRIAL_MONTHS_MAX) {
      return "trialMonths";
    }
  } else if (s.trialMonths !== 0) {
    return "trialMonths";
  }
  return null;
}

export function plansProblem(plans: Record<PlanId, PlanSettings>): PlanProblem | null {
  for (const id of PLAN_IDS) {
    const problem = planSettingsProblem(id, plans[id]);
    if (problem !== null) return problem;
  }
  return PLAN_IDS.some((id) => plans[id].visible) ? null : "noVisiblePlan";
}

/** A value of the right kind, never negative, within the feature's ceiling. */
export function featureValueProblem(key: FeatureKey, value: FeatureValue): "kind" | "range" | null {
  const def = featureDef(key);
  if (def.kind === "flag") return typeof value === "boolean" ? null : "kind";
  if (value === null) return def.unlimited ? null : "range";
  if (typeof value !== "number") return "kind";
  return Number.isInteger(value) && value >= 0 && value <= def.max ? null : "range";
}

export function pricingProblem(key: FeatureKey, p: FeaturePricing): "label" | "order" | null {
  if (!Number.isInteger(p.order) || p.order < 0 || p.order > FEATURE_ORDER_MAX) return "order";
  if (!localizedOk(p.label, PRICING_LABEL_MAX) || !localizedOk(p.cardLabel, PRICING_LABEL_MAX)) return "label";
  if (!localizedOk(p.hint, PRICING_LABEL_MAX) || !localizedOk(p.offLabel, PRICING_LABEL_MAX)) return "label";
  if (!localizedOk(p.unlimitedLabel, PRICING_LABEL_MAX)) return "label";
  if (p.unlimitedLabel !== undefined && featureDef(key).kind !== "limit") return "label";
  if (p.offLabel !== undefined && featureDef(key).kind !== "flag") return "label";
  return null;
}

/** Null when the whole configuration is valid. */
export function planConfigProblem(config: PlanConfigData): string | null {
  const plans = plansProblem(config.plans);
  if (plans !== null) return plans;
  for (const key of FEATURE_KEYS) {
    const f = config.features[key];
    for (const id of PLAN_IDS) if (featureValueProblem(key, f.values[id]) !== null) return `value:${key}`;
    if (pricingProblem(key, f.pricing) !== null) return `pricing:${key}`;
  }
  return null;
}

/** Trims every text so stored labels never carry stray spaces. */
export function trimLocalized(text: Localized): Localized {
  return { en: text.en.trim(), fr: text.fr.trim() };
}
