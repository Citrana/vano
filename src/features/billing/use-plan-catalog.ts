"use client"

import { useQuery } from "convex/react"
import { useLocale } from "next-intl"
import { useCallback } from "react"
import { api } from "../../../convex/_generated/api"
import { catalogOf, lowestPlanFor, planNameIn, type PlanCatalog } from "../../../convex/lib/planCatalog"
import { DEFAULT_PLAN_CONFIG } from "../../../convex/lib/planDefaults"
import type { FeatureFlag } from "../../../convex/lib/planFeatures"
import type { PlanId } from "../../../convex/lib/plans"

/**
 * The live plan catalogue (names, prices, what each plan includes), from
 * the plan config edited on the admin "Plans & features" page. Reactive:
 * open screens update when an admin saves. Undefined while loading.
 */
export function usePlanCatalog(): PlanCatalog | undefined {
  // The query returns plain keys; they are the catalogue's own feature keys.
  return useQuery(api.plans.catalog, {}) as PlanCatalog | undefined
}

/** Plan names in the viewer's language (the seed's names while loading). */
export function usePlanName(): (id: PlanId) => string {
  const catalog = usePlanCatalog()
  const locale = useLocale()
  return useCallback(
    (id: PlanId) => {
      if (catalog) return planNameIn(catalog, id, locale)
      const name = DEFAULT_PLAN_CONFIG.plans[id].name
      return locale === "fr" ? name.fr : name.en
    },
    [catalog, locale],
  )
}

/**
 * The name of the cheapest plan that includes a feature, for in-app
 * upgrade notes ("Available on Pro"). Follows the live plan config.
 */
export function useUpgradePlanName(feature: FeatureFlag): string {
  return useUpgradePlanNames()(feature)
}

export function useUpgradePlanNames(): (feature: FeatureFlag) => string {
  const catalog = usePlanCatalog()
  const planName = usePlanName()
  return useCallback(
    (feature: FeatureFlag) => {
      const plan = lowestPlanFor(catalog ?? catalogOf(DEFAULT_PLAN_CONFIG), feature)
      return planName(plan ?? "enterprise")
    },
    [catalog, planName],
  )
}
