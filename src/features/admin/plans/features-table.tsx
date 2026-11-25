"use client"

import { ListChecksIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  FEATURE_KEYS,
  featureDef,
  type FeatureKey,
  type FeatureValue,
  type PlanConfigData,
} from "../../../../convex/lib/planFeatures"
import { PLAN_IDS, TRIAL_PLAN, type PlanId } from "../../../../convex/lib/plans"
import { Badge } from "@/components/ui/badge"
import { usePlanName } from "@/features/billing/use-plan-catalog"
import { DataTable } from "@/components/data-table/data-table"
import { TablePagination } from "@/components/data-table/table-pagination"
import type { Column } from "@/components/data-table/types"
import { useLocalPages } from "@/components/data-table/use-table-pages"
import type { TableState } from "@/components/data-table/use-table-state"
import { FeatureValueControl } from "./feature-value-control"

type Row = { key: FeatureKey; name: string; description: string }

/**
 * Features × plans. A switch or a number in each cell changes it at once
 * (a change that takes something away asks first). On phones a row opens
 * the feature's drawer with the same controls and its pricing-page text.
 */
export function FeaturesTable({
  table,
  config,
  canEdit,
  onChange,
}: {
  table: TableState
  config: PlanConfigData
  canEdit: boolean
  onChange: (feature: FeatureKey, plan: PlanId, value: FeatureValue) => void
}) {
  const t = useTranslations("AdminPlans")
  const tf = useTranslations("PlanFeatures")
  const ta = useTranslations("PlanAreas")
  const planName = usePlanName()

  const search = table.search.trim().toLowerCase()
  const area = table.filters.area
  const check = table.filters.check
  const rows: Row[] = FEATURE_KEYS.map((key) => ({ key, name: tf(`${key}.name`), description: tf(`${key}.description`) }))
    .filter((r) => !area || featureDef(r.key).area === area)
    .filter((r) => !check || (check === "enforced") === featureDef(r.key).enforced)
    .filter((r) => !search || `${r.name} ${r.description} ${r.key}`.toLowerCase().includes(search))
    .sort((a, b) => config.features[a.key].pricing.order - config.features[b.key].pricing.order)
  const pages = useLocalPages(rows, table)

  const columns: Column<Row>[] = [
    {
      id: "feature",
      header: t("feature"),
      mobile: "title",
      className: "max-w-72",
      cell: (r) => r.name,
    },
    {
      id: "area",
      header: t("area"),
      mobile: "subtitle",
      muted: true,
      hideBelow: "lg",
      cell: (r) => (
        <span className="flex items-center gap-2">
          {ta(featureDef(r.key).area)}
          {featureDef(r.key).enforced ? null : <Badge variant="muted">{t("pricingOnly")}</Badge>}
        </span>
      ),
    },
    ...PLAN_IDS.map(
      (plan): Column<Row> => ({
        id: plan,
        // Trial shops get exactly the trial plan's column (Pro), never more.
        header: plan === TRIAL_PLAN ? t("trialHeader", { plan: planName(plan) }) : planName(plan),
        cell: (r) => (
          <FeatureValueControl
            config={config}
            feature={r.key}
            plan={plan}
            disabled={!canEdit}
            onChange={(value) => onChange(r.key, plan, value)}
          />
        ),
      }),
    ),
    {
      id: "pricing",
      header: t("pricingColumn"),
      muted: true,
      hideBelow: "xl",
      mobile: "meta",
      cell: (r) => (config.features[r.key].pricing.show ? t("shown") : t("hidden")),
    },
  ]

  return (
    <DataTable
      label={t("featuresTitle")}
      columns={columns}
      rows={pages.rows}
      getRowId={(r) => r.key}
      loading={pages.loading}
      empty={{ icon: <ListChecksIcon />, title: t("noMatchTitle"), body: t("noMatchBody") }}
      onClearFilters={table.filtered ? table.clearFilters : undefined}
      onRowOpen={(r) => table.openRow(r.key)}
      activeRowId={table.open}
      footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
    />
  )
}
