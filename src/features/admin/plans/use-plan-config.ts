"use client"

import { useConvex, useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import {
  loweredFeatures,
  withFeatureValue,
  type FeatureKey,
  type FeatureValue,
  type PlanConfigData,
} from "../../../../convex/lib/planFeatures"
import type { PlanId } from "../../../../convex/lib/plans"
import { useErrorMessage } from "@/lib/use-error-message"

export type AdminPlanConfig = FunctionReturnType<typeof api.admin.plans.get>
export type ImpactResult = FunctionReturnType<typeof api.admin.plans.impact>

/** The live config (reactive: another admin's save shows up here at once). */
export function useAdminPlanConfig(): (PlanConfigData & { version: number; updatedAt: number | null }) | undefined {
  const config = useQuery(api.admin.plans.get, {})
  // Stored records are keyed by feature key; the server merges them over the seed.
  return config as (PlanConfigData & { version: number; updatedAt: number | null }) | undefined
}

/** What the impact dialog shows; `impact` is null while it loads. */
export type PendingChange = {
  kind: "value" | "reset"
  impact: ImpactResult | null
  run: () => Promise<void>
}

/**
 * Switching a feature or setting a limit from the grid or the drawer.
 * A change that takes something away first asks the server how many
 * shops it affects and waits for the admin to confirm (`pending`).
 */
export function useFeatureChange(config: (PlanConfigData & { version: number }) | undefined) {
  const t = useTranslations("AdminPlans")
  const convex = useConvex()
  const setValue = useMutation(api.admin.plans.setFeatureValue)
  const errorMessage = useErrorMessage()
  const [pending, setPending] = useState<PendingChange | null>(null)

  async function save(feature: FeatureKey, plan: PlanId, value: FeatureValue, version: number) {
    try {
      await setValue({ expectedVersion: version, feature, plan, value })
      toast.success(t("saved"))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  function change(feature: FeatureKey, plan: PlanId, value: FeatureValue) {
    if (!config) return
    const version = config.version
    const lowers = loweredFeatures(config, withFeatureValue(config, feature, plan, value)).length > 0
    if (!lowers) {
      void save(feature, plan, value, version)
      return
    }
    const run = () => save(feature, plan, value, version)
    setPending({ kind: "value", impact: null, run })
    convex
      .query(api.admin.plans.impact, { change: { kind: "value", feature, plan, value } })
      .then((impact) => setPending((p) => (p && p.run === run ? { ...p, impact } : p)))
      .catch((error: unknown) => {
        setPending(null)
        toast.error(errorMessage(error))
      })
  }

  return { change, pending, setPending }
}
