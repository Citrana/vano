"use client"

import type { FunctionReturnType } from "convex/server"
import { CreditCardIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { api } from "../../../../convex/_generated/api"
import type { PlanId, SubscriptionStatus } from "../../../../convex/lib/plans"
import { PageTitle } from "@/components/shell/page-title"
import { DataTable, TableBoundary } from "../data-table/data-table"
import { DetailsDrawer } from "../data-table/details-drawer"
import { filterDefs } from "../data-table/filters"
import { StatusTag } from "../data-table/status-tag"
import { TablePagination } from "../data-table/table-pagination"
import { TableToolbar } from "../data-table/table-toolbar"
import type { Column } from "../data-table/types"
import { useTablePages } from "../data-table/use-table-pages"
import { useTableState, type TableState } from "../data-table/use-table-state"
import { dayRange } from "../data-table/url-state"
import { ShopDetails } from "../shops/shop-details"
import { SUBSCRIPTIONS_SPEC } from "./table-spec"

type Row = FunctionReturnType<typeof api.admin.billing.subscriptions>["page"][number]

/**
 * /admin/subscriptions: every shop's plan, soonest ending first. The URL
 * can preset the filters (`?from=&to=` = ends between). A row opens the
 * shop drawer (plan panel with grant / extend).
 */
export function SubscriptionsSection() {
  const t = useTranslations("AdminBilling")
  const ts = useTranslations("Billing.status")
  const tp = useTranslations("Pricing.plans")
  const tshop = useTranslations("AdminShops")
  const filters = useMemo(
    () =>
      filterDefs(SUBSCRIPTIONS_SPEC, {
        status: { label: t("status"), allLabel: t("allStatuses"), optionLabel: (s) => ts(s as SubscriptionStatus) },
        plan: { label: t("plan"), allLabel: t("allPlans"), optionLabel: (p) => tp(`${p as PlanId}.name`) },
        from: { label: t("ends") },
      }),
    [t, ts, tp],
  )
  const table = useTableState(SUBSCRIPTIONS_SPEC)

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("subscriptionsTitle")} />
      <TableToolbar table={table} filters={filters} search={{ label: t("search"), placeholder: t("searchPlaceholder") }} />
      <TableBoundary>
        <SubscriptionsTable table={table} />
      </TableBoundary>
      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={tshop("detailsTitle")} wide>
        {(id) => <ShopDetails shopId={id} />}
      </DetailsDrawer>
    </div>
  )
}

function SubscriptionsTable({ table }: { table: TableState }) {
  const t = useTranslations("AdminBilling")
  const tp = useTranslations("Pricing.plans")
  const format = useFormatter()
  const { filters } = table
  const ends = dayRange({ from: filters.from, to: filters.to })
  const pages = useTablePages(
    api.admin.billing.subscriptions,
    {
      search: table.search || undefined,
      plan: (filters.plan || undefined) as PlanId | undefined,
      status: (filters.status || undefined) as SubscriptionStatus | undefined,
      endsFrom: ends.from,
      endsTo: ends.to,
      order: table.search ? undefined : table.order,
    },
    table,
  )

  const columns: Column<Row>[] = [
    { id: "shop", header: t("shop"), cell: (r) => r.shopName, className: "max-w-60", mobile: "title" },
    { id: "plan", header: t("plan"), cell: (r) => tp(`${r.plan}.name`), mobile: "subtitle" },
    { id: "status", header: t("status"), cell: (r) => <StatusTag kind="subscription" status={r.status} />, mobile: "trailing" },
    {
      id: "ends",
      header: t("ends"),
      sortable: true,
      cell: (r) => (r.periodEnd === null ? t("noEnd") : format.dateTime(new Date(r.periodEnd), { dateStyle: "medium" })),
      className: "whitespace-nowrap tabular-nums",
      mobile: "meta",
    },
    { id: "source", header: t("source"), cell: (r) => t(`sources.${r.source}`), muted: true, hideBelow: "lg" },
  ]

  return (
    <DataTable
      label={t("subscriptionsTitle")}
      columns={columns}
      rows={pages.rows}
      getRowId={(r) => r.shopId}
      loading={pages.loading}
      skeletonRows={table.size}
      empty={{
        icon: <CreditCardIcon />,
        title: t("emptySubscriptionsTitle"),
        body: table.filtered ? t("emptyFilteredBody") : t("emptySubscriptionsBody"),
      }}
      onClearFilters={table.filtered ? table.clearFilters : undefined}
      onRowOpen={(r) => table.openRow(r.shopId)}
      activeRowId={table.open}
      sort={{ columnId: "ends", order: table.order, onChange: table.setOrder, disabled: table.search !== "" }}
      footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
    />
  )
}
