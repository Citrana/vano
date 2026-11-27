import {
  addedFeatures,
  cardLineFor as lineFor,
  includedValue as included,
  localizedIn,
  planCta,
  type CardLine,
  type PlanCatalog,
  type PlanCta,
} from "../../../../convex/lib/planCatalog"
import { PLAN_AREAS, isLower, type PlanArea } from "../../../../convex/lib/planFeatures"
import type { PlanId } from "../../../../convex/lib/plans"

/**
 * Pricing display, DERIVED from the plan catalogue (`plans.catalog`, the
 * live plan config edited on the admin "Plans & features" page). Nothing
 * here is data: cards, the comparison table and the starting price are
 * computed, so the pricing page, the plan comparison and the seller's
 * plan options always match what the app enforces. Pure (tested with the
 * seed).
 */

export type { CardLine }

export type Plan = {
  id: PlanId
  name: string
  /** Minor units per month; null = custom price ("Talk to us"). */
  priceMinor: number | null
  /** Months saved by paying yearly, when a yearly price is set. */
  yearlyFreeMonths: number | null
  highlight: boolean
  /** free = "Start free", trial = "Start free trial" (Pro), buy = "Get Business" (pay now), talk = WhatsApp. */
  cta: PlanCta
  features: CardLine[]
}

/** A cell of the comparison table: check, dash, a number or "unlimited". */
export type CompareCell = boolean | { count: number } | { label: "unlimited" }
export type CompareRow = { key: string; label: string; hint?: string; cells: Record<PlanId, CompareCell> }
export type CompareGroup = { key: PlanArea; rows: CompareRow[] }

/** Plans shown on the pricing page and in the seller's plan options. */
export function visiblePlans(catalog: PlanCatalog) {
  return catalog.plans.filter((p) => p.visible)
}

function yearlyFreeMonths(monthly: number | null, yearly: number | null): number | null {
  if (monthly === null || monthly <= 0 || yearly === null) return null
  const months = Math.round((monthly * 12 - yearly) / monthly)
  return months > 0 ? months : null
}

/**
 * The plan cards. The first plan lists what it includes; each next plan
 * says "Everything in <previous>" (when the previous one is paid) and adds
 * what it gives more, in the admin's order (`pricing.order`).
 */
export function buildPlanCards(
  catalog: PlanCatalog,
  locale: string,
  everythingIn: (planName: string) => string,
): Plan[] {
  const plans = visiblePlans(catalog)
  const cardFeatures = catalog.features.filter((f) => f.pricing.show && f.pricing.showOnCard)
  return plans.map((plan, i) => {
    const prev = i > 0 ? plans[i - 1] : null
    const lines: CardLine[] = []
    if (prev === null) {
      for (const f of cardFeatures) {
        const value = f.values[plan.id]
        if (included(value)) lines.push(lineFor(f, value, locale))
        else if (f.kind === "flag" && f.pricing.offLabel) {
          lines.push({ key: f.key, label: localizedIn(f.pricing.offLabel, locale) })
        }
      }
    } else {
      if (prev.monthlyMinor !== 0) {
        lines.push({ key: `everything-${prev.id}`, label: everythingIn(localizedIn(prev.name, locale)) })
      }
      for (const f of cardFeatures) {
        const value = f.values[plan.id]
        if (included(value) && isLower(value, f.values[prev.id])) lines.push(lineFor(f, value, locale))
      }
    }
    return {
      id: plan.id,
      name: localizedIn(plan.name, locale),
      priceMinor: plan.monthlyMinor,
      yearlyFreeMonths: yearlyFreeMonths(plan.monthlyMinor, plan.yearlyMinor),
      highlight: plan.id === catalog.trialPlan,
      cta: planCta(catalog, plan),
      features: lines,
    }
  })
}

/** What moving up unlocks (the upgrade dialog, the receipt email): one rule in the plan catalogue. */
export { addedFeatures }

/** "Compare all features": rows grouped by area, in the admin's order. */
export function buildComparison(catalog: PlanCatalog, locale: string): CompareGroup[] {
  const plans = visiblePlans(catalog)
  return PLAN_AREAS.flatMap((area) => {
    const rows = catalog.features
      .filter((f) => f.area === area && f.pricing.show)
      .map((f) => ({
        key: f.key,
        label: localizedIn(f.pricing.label, locale),
        hint: f.pricing.hint ? localizedIn(f.pricing.hint, locale) : undefined,
        cells: Object.fromEntries(
          plans.map((p) => {
            const value = f.values[p.id]
            const cell: CompareCell =
              typeof value === "boolean" ? value : value === null ? { label: "unlimited" } : { count: value }
            return [p.id, cell]
          }),
        ) as Record<PlanId, CompareCell>,
      }))
    return rows.length > 0 ? [{ key: area, rows }] : []
  })
}

/** Lowest paid monthly price among visible plans, for "then from … /month". */
export function startingPriceMinor(catalog: PlanCatalog): number | null {
  const prices = visiblePlans(catalog).flatMap((p) => (p.monthlyMinor && p.monthlyMinor > 0 ? [p.monthlyMinor] : []))
  return prices.length > 0 ? Math.min(...prices) : null
}

/** Plan prices in shillings ("Ksh 299" / "299 KES"), shared with the server emails. */
export { formatPlanPrice } from "../../../../convex/lib/plans"
