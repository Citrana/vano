"use client"

import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { canShopDo } from "../../../convex/lib/entitlements"
import { toPlanLimits } from "../../../convex/lib/planFeatures"
import { useShopLimits } from "@/features/billing/use-billing"
import { useUpgradePlanName } from "@/features/billing/use-plan-catalog"

/**
 * Whether the viewer may record sales (`ownSales.manage`) and whether the
 * plan allows it (`salesReports`, the pure `canShopDo`). Hiding or
 * locking a button is never security: the server checks both again.
 * `ready` = both are known, so no lock flashes while loading.
 */
export function useSalesAccess() {
  const viewer = useQuery(api.users.viewer, {})
  const billing = useShopLimits()
  const plan = useUpgradePlanName("salesReports")
  const ready = viewer !== undefined && billing !== undefined
  const allowed = viewer?.permissions.includes("ownSales.manage") ?? false
  const locked = billing ? canShopDo(toPlanLimits(billing.limits), { kind: "feature", feature: "salesReports" }) !== null : false
  return { ready, allowed, locked, plan }
}
