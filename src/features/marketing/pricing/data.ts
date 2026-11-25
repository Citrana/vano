import "server-only"
import { fetchQuery } from "convex/nextjs"
import { cache } from "react"
import { api } from "../../../../convex/_generated/api"
import { planNameIn, type PlanCatalog } from "../../../../convex/lib/planCatalog"
import { PERIOD_DAYS } from "../../../../convex/lib/plans"

/**
 * The plan catalogue for server-rendered marketing pages (pricing, home,
 * features, share images), from the live plan config edited on the admin
 * "Plans & features" page. Deduplicated per request.
 */
export const getPlanCatalog = cache(async (): Promise<PlanCatalog> => {
  // The query returns plain keys; they are the catalogue's own feature keys.
  return (await fetchQuery(api.plans.catalog, {})) as PlanCatalog
})

export type PlanTexts = { months: number; plan: string; free: string; business: string; days: number }

/**
 * Values for marketing text about plans, never written into the text: the
 * trial length and the plan it's on ("2 months free on Pro"; the trial is
 * never on every plan), the Free and Business names, and the paid period.
 */
export async function getPlanTexts(locale: string): Promise<PlanTexts> {
  const catalog = await getPlanCatalog()
  return {
    months: catalog.trialMonths,
    plan: planNameIn(catalog, catalog.trialPlan, locale),
    free: planNameIn(catalog, "free", locale),
    business: planNameIn(catalog, "business", locale),
    days: PERIOD_DAYS,
  }
}
