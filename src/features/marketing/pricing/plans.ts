import { formatMoney } from "../../../../convex/lib/money"
import {
  PLAN_CURRENCY,
  PLAN_IDS,
  PLAN_LIMITS,
  PLAN_PRICE_MINOR,
  TRIAL_MONTHS,
  type PlanId,
} from "../../../../convex/lib/plans"

/**
 * Marketing display data for the plans: cards, feature lists and the
 * comparison table. Plan ids, prices, limits and the trial come from
 * `convex/lib/plans.ts` (the one source, also used by billing and limit
 * checks). Labels live in messages under `Pricing.plans.<id>` and
 * `Pricing.features.<key>`; numbers here are interpolated into them.
 */
export { PLAN_CURRENCY, TRIAL_MONTHS, type PlanId }

/** Yearly billing: Pro yearly = 2 months free. Not available yet. Shown on that plan's card. */
export const YEARLY = { comingSoon: true, freeMonths: 2, plan: "pro" } as const

/** Card lines. Labels: `Pricing.features.<key>`; `values` fill its {placeholders}. */
export type FeatureKey =
  | "products"
  | "photos"
  | "vanoLink"
  | "whatsappOrders"
  | "oneBasicLook"
  | "salesPromotions"
  | "productsAndPhotos"
  | "allLooks"
  | "categoriesSizesColors"
  | "shopStats"
  | "prioritySupport"
  | "everythingPro"
  | "unlimitedProducts"
  | "discountCodes"
  | "teamRoles"
  | "orderTracking"
  | "salesReports"
  | "everythingBusiness"
  | "multiShop"
  | "personalizedSetup"
  | "dedicatedContact"
  | "customIntegrations"
  | "serviceGuarantees"

/** `hint` adds a small muted line under the label: `Pricing.featureHints.<key>`. */
export type PlanFeature = { key: FeatureKey; values?: Record<string, number>; hint?: true }

export type Plan = {
  id: PlanId
  /** Minor units per month; null = custom price ("Talk to us"). */
  priceMinor: number | null
  highlight?: boolean
  /** free = "Start free", trial = "Start free trial", talk = WhatsApp. */
  cta: "free" | "trial" | "talk"
  /** The top 5–6 items shown on the card. The full list is COMPARISON. */
  features: PlanFeature[]
}

const perPlanValue = <V,>(fn: (id: PlanId) => V) =>
  Object.fromEntries(PLAN_IDS.map((id) => [id, fn(id)])) as Record<PlanId, V>
/** Product limits per plan (null = unlimited). Used by cards and the table. */
export const PRODUCT_LIMITS: Record<PlanId, number | null> = perPlanValue((id) => PLAN_LIMITS[id].products)
/** Photos per product. Used by cards and the table. */
export const PHOTO_LIMITS: Record<PlanId, number> = perPlanValue((id) => PLAN_LIMITS[id].photosPerProduct)

export const PLANS: Plan[] = [
  {
    id: "free",
    priceMinor: PLAN_PRICE_MINOR.free,
    cta: "free",
    features: [
      { key: "products", values: { count: PRODUCT_LIMITS.free! } },
      { key: "vanoLink" },
      { key: "whatsappOrders" },
      { key: "oneBasicLook" },
      { key: "photos", values: { count: PHOTO_LIMITS.free } },
    ],
  },
  {
    id: "pro",
    priceMinor: PLAN_PRICE_MINOR.pro,
    highlight: true,
    cta: "trial",
    features: [
      { key: "salesPromotions", hint: true },
      { key: "productsAndPhotos", values: { products: PRODUCT_LIMITS.pro!, photos: PHOTO_LIMITS.pro } },
      { key: "allLooks" },
      { key: "categoriesSizesColors" },
      { key: "shopStats" },
      { key: "prioritySupport" },
    ],
  },
  {
    id: "business",
    priceMinor: PLAN_PRICE_MINOR.business,
    cta: "trial",
    features: [
      { key: "everythingPro" },
      { key: "unlimitedProducts" },
      { key: "discountCodes" },
      { key: "teamRoles" },
      { key: "orderTracking" },
      { key: "salesReports" },
    ],
  },
  {
    id: "enterprise",
    priceMinor: PLAN_PRICE_MINOR.enterprise,
    cta: "talk",
    features: [
      { key: "everythingBusiness" },
      { key: "multiShop" },
      { key: "personalizedSetup" },
      { key: "dedicatedContact" },
      { key: "customIntegrations" },
      { key: "serviceGuarantees" },
    ],
  },
]

/** A cell of the comparison table: check, dash, a number or a short label. */
export type CompareCell = boolean | { count: number } | { label: CompareLabel }
export type CompareLabel = "unlimited" | "all" | "standard" | "priority" | "dedicated"
export type CompareGroupKey = "shop" | "selling" | "stats" | "team" | "support"
export type CompareRowKey =
  | "products"
  | "photosPerProduct"
  | "shopLink"
  | "shopLooks"
  | "colorsLogoBanner"
  | "categoriesSizesColors"
  | "featuredSections"
  | "customDomain"
  | "multiShop"
  | "customBranding"
  | "whatsappOrders"
  | "salesPromotions"
  | "qrShareImages"
  | "stockLabels"
  | "discountCodes"
  | "orderTracking"
  | "stockManagement"
  | "customerList"
  | "shopStats"
  | "salesReports"
  | "advancedStats"
  | "teamRoles"
  | "bulkUpload"
  | "customIntegrations"
  | "support"
  | "personalizedSetup"
  | "serviceGuarantees"
export type CompareRow = { key: CompareRowKey; hint?: true; cells: Record<PlanId, CompareCell> }
export type CompareGroup = { key: CompareGroupKey; rows: CompareRow[] }

const perPlan = (fn: (id: PlanId) => CompareCell) => perPlanValue(fn)
/** Included from `from` upwards (free < pro < business < enterprise). */
const from = (first: PlanId) => perPlan((id) => PLAN_IDS.indexOf(id) >= PLAN_IDS.indexOf(first))

/** "Compare all features": the full list. Labels: `Pricing.compare.<key>`. */
export const COMPARISON: CompareGroup[] = [
  {
    key: "shop",
    rows: [
      { key: "products", cells: perPlan((id) => (PRODUCT_LIMITS[id] === null ? { label: "unlimited" } : { count: PRODUCT_LIMITS[id]! })) },
      { key: "photosPerProduct", cells: perPlan((id) => ({ count: PHOTO_LIMITS[id] })) },
      { key: "shopLink", cells: from("free") },
      { key: "shopLooks", cells: perPlan((id) => (id === "free" ? { count: 1 } : { label: "all" })) },
      { key: "colorsLogoBanner", cells: from("pro") },
      { key: "categoriesSizesColors", cells: from("pro") },
      { key: "featuredSections", cells: from("pro") },
      { key: "customDomain", cells: from("business") },
      { key: "multiShop", cells: from("enterprise") },
      { key: "customBranding", cells: from("enterprise") },
    ],
  },
  {
    key: "selling",
    rows: [
      { key: "whatsappOrders", cells: from("free") },
      { key: "salesPromotions", hint: true, cells: from("pro") },
      { key: "qrShareImages", cells: from("pro") },
      { key: "stockLabels", cells: from("pro") },
      { key: "discountCodes", cells: from("business") },
      { key: "orderTracking", cells: from("business") },
      { key: "stockManagement", cells: from("business") },
      { key: "customerList", cells: from("business") },
    ],
  },
  {
    key: "stats",
    rows: [
      { key: "shopStats", cells: from("pro") },
      { key: "salesReports", cells: from("business") },
      { key: "advancedStats", cells: from("business") },
    ],
  },
  {
    key: "team",
    rows: [
      { key: "teamRoles", cells: from("business") },
      { key: "bulkUpload", cells: from("business") },
      { key: "customIntegrations", cells: from("enterprise") },
    ],
  },
  {
    key: "support",
    rows: [
      {
        key: "support",
        cells: { free: { label: "standard" }, pro: { label: "priority" }, business: { label: "priority" }, enterprise: { label: "dedicated" } },
      },
      { key: "personalizedSetup", cells: from("enterprise") },
      { key: "serviceGuarantees", cells: from("enterprise") },
    ],
  },
]

/** Lowest paid monthly price, for "then from … /month". */
export const STARTING_PRICE_MINOR: number = Math.min(
  ...PLANS.flatMap((p) => (p.priceMinor && p.priceMinor > 0 ? [p.priceMinor] : [])),
)

/**
 * Plan prices in shillings. Uses the regional en-KE locale for English
 * ("Ksh 299"); French keeps "299 KES". Still formatted by formatMoney.
 */
export function formatPlanPrice(minor: number, locale: string): string {
  return formatMoney(minor, PLAN_CURRENCY, locale === "fr" ? "fr" : "en-KE")
}
