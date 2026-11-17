import { formatMoney, type Currency } from "../../../../convex/lib/money"

/**
 * Vano plans: the ONE place for plan names (ids), prices, limits and
 * feature lists. Display only for now: no billing, limits aren't enforced.
 * Labels live in messages under `Pricing.plans.<id>` and
 * `Pricing.features.<key>`; numbers here are interpolated into them.
 */
export const TRIAL_MONTHS = 2
export const PLAN_CURRENCY: Currency = "KES"

/** Yearly billing: Pro yearly = 2 months free. Not available yet. */
export const YEARLY = { comingSoon: true, freeMonths: 2 } as const

export type PlanId = "free" | "pro" | "business" | "enterprise"
export type FeatureKey =
  | "products"
  | "unlimitedProducts"
  | "vanoLink"
  | "whatsappOrders"
  | "basicLook"
  | "fullDesign"
  | "stats"
  | "prioritySupport"
  | "everythingPro"
  | "teamAccounts"
  | "advancedStats"
  | "salesReports"
  | "personalized"

export type PlanFeature = { key: FeatureKey; count?: number; comingSoon?: boolean }

export type Plan = {
  id: PlanId
  /** Minor units per month; null = custom price ("Talk to us"). */
  priceMinor: number | null
  highlight?: boolean
  cta: "signup" | "whatsapp"
  features: PlanFeature[]
}

export const PLANS: Plan[] = [
  {
    id: "free",
    priceMinor: 0,
    cta: "signup",
    features: [{ key: "products", count: 10 }, { key: "vanoLink" }, { key: "whatsappOrders" }, { key: "basicLook" }],
  },
  {
    id: "pro",
    priceMinor: 29900,
    highlight: true,
    cta: "signup",
    features: [{ key: "products", count: 50 }, { key: "fullDesign" }, { key: "stats" }, { key: "prioritySupport" }],
  },
  {
    id: "business",
    priceMinor: 100000,
    cta: "signup",
    features: [
      { key: "unlimitedProducts" },
      { key: "everythingPro" },
      { key: "teamAccounts" },
      { key: "advancedStats" },
      { key: "salesReports", comingSoon: true },
    ],
  },
  { id: "enterprise", priceMinor: null, cta: "whatsapp", features: [{ key: "personalized" }] },
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
