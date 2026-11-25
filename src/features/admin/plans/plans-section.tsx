"use client"

import { useConvex, useMutation } from "convex/react"
import { RotateCcwIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import { PLAN_AREAS } from "../../../../convex/lib/planFeatures"
import { PLAN_IDS, TRIAL_PLAN } from "../../../../convex/lib/plans"
import { PageTitle } from "@/components/shell/page-title"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { usePlanName } from "@/features/billing/use-plan-catalog"
import { useErrorMessage } from "@/lib/use-error-message"
import { TableBoundary } from "../data-table/data-table"
import { DetailsDrawer } from "../data-table/details-drawer"
import { filterDefs } from "../data-table/filters"
import { TableToolbar } from "../data-table/table-toolbar"
import { useTableState } from "../data-table/use-table-state"
import { ConfirmImpactDialog } from "./confirm-impact-dialog"
import { FeatureDetails } from "./feature-details"
import { FeaturesTable } from "./features-table"
import { PlanSettingsCard } from "./plan-settings-card"
import { PLAN_FEATURES_SPEC } from "./table-spec"
import { useAdminPlanConfig, useFeatureChange } from "./use-plan-config"

/**
 * /admin/plans "Plans & features" (CLAUDE.md "Billing"): the one place
 * plans change without code. Plan cards (name, prices, trial, shown on
 * the pricing page), then the features × plans grid. Everything the app
 * checks, the pricing page and the plan comparison read from here.
 */
export function PlansSection() {
  const t = useTranslations("AdminPlans")
  const ta = useTranslations("PlanAreas")
  const planName = usePlanName()
  const format = useFormatter()
  const config = useAdminPlanConfig()
  const table = useTableState(PLAN_FEATURES_SPEC)
  const { change, pending, setPending } = useFeatureChange(config)
  const convex = useConvex()
  const reset = useMutation(api.admin.plans.resetToDefaults)
  const errorMessage = useErrorMessage()
  const filters = useMemo(
    () =>
      filterDefs(PLAN_FEATURES_SPEC, {
        area: { label: t("area"), allLabel: t("allAreas"), optionLabel: (a) => ta(a as (typeof PLAN_AREAS)[number]) },
        check: { label: t("check"), allLabel: t("allChecks"), optionLabel: (c) => t(`checks.${c as "enforced" | "pricingOnly"}`) },
      }),
    [t, ta],
  )

  if (!config) return <><PageTitle title={t("title")} /><LoadingState /></>

  function askReset() {
    if (!config) return
    const version = config.version
    const run = async () => {
      try {
        await reset({ expectedVersion: version })
        toast.success(t("resetDone"))
      } catch (error) {
        toast.error(errorMessage(error))
      }
    }
    setPending({ kind: "reset", impact: null, run })
    convex
      .query(api.admin.plans.impact, { change: { kind: "reset" } })
      .then((impact) => setPending((p) => (p && p.run === run ? { ...p, impact } : p)))
      .catch((error: unknown) => {
        setPending(null)
        toast.error(errorMessage(error))
      })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title={t("title")}
        action={
          <Button variant="outline" onClick={askReset}>
            <RotateCcwIcon aria-hidden />
            {t("reset")}
          </Button>
        }
      />
      <p className="-mt-3 text-sm text-muted-foreground">
        {t("intro")}
        {config.updatedAt !== null ? ` ${t("updated", { date: format.dateTime(new Date(config.updatedAt), { dateStyle: "medium", timeStyle: "short" }) })}` : null}
      </p>

      <section aria-labelledby="plans-title" className="flex flex-col gap-3">
        <h2 id="plans-title" className="font-heading text-lg font-bold tracking-tight">{t("plansTitle")}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {PLAN_IDS.map((plan) => (
            <PlanSettingsCard key={plan} plan={plan} settings={config.plans[plan]} version={config.version} disabled={false} />
          ))}
        </div>
      </section>

      <section aria-labelledby="features-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="features-title" className="font-heading text-lg font-bold tracking-tight">{t("featuresTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("featuresHelp")}</p>
          <p className="text-sm text-muted-foreground">{t("trialTagHelp", { plan: planName(TRIAL_PLAN), business: planName("business") })}</p>
        </div>
        <TableToolbar table={table} filters={filters} search={{ label: t("search"), placeholder: t("searchPlaceholder") }} />
        <TableBoundary>
          <FeaturesTable table={table} config={config} canEdit onChange={change} />
        </TableBoundary>
      </section>

      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("featureTitle")} wide>
        {(id) => <FeatureDetails featureKey={id} config={config} canEdit onChange={change} />}
      </DetailsDrawer>
      <ConfirmImpactDialog pending={pending} onClose={() => setPending(null)} />
    </div>
  )
}
