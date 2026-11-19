"use client"

import type { FunctionReturnType } from "convex/server"
import { AlertTriangleIcon, FilePenLineIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { api } from "../../../../convex/_generated/api"
import type { ChangeStatus, ProtectedField } from "../../../../convex/lib/changeRequests"
import { PageTitle } from "@/components/shell/page-title"
import { displayValue } from "@/features/change-requests/display-value"
import { DataTable, TableBoundary } from "../data-table/data-table"
import { DetailsDrawer } from "../data-table/details-drawer"
import { StatusTag } from "../data-table/status-tag"
import { TablePagination } from "../data-table/table-pagination"
import { TableToolbar } from "../data-table/table-toolbar"
import { filterDefs } from "../data-table/filters"
import type { Column } from "../data-table/types"
import { useTablePages } from "../data-table/use-table-pages"
import { useTableState, type TableState } from "../data-table/use-table-state"
import { dayRange } from "../data-table/url-state"
import { ChangeRequestDetails } from "./change-request-details"
import { CHANGE_REQUESTS_SPEC } from "./table-spec"

type Row = FunctionReturnType<typeof api.admin.changeRequests.list>["page"][number]

/**
 * /admin/change-requests: pending first. Filters, page and the open
 * request live in the URL (`?status=pending&flagged=1&open=<id>`), so the
 * attention cards and notifications open the right view.
 */
export function ChangeRequestsSection() {
  const t = useTranslations("AdminChangeRequests")
  const ts = useTranslations("ChangeRequests.status")
  const tf = useTranslations("ChangeRequests.fieldName")

  const filters = useMemo(
    () =>
      filterDefs(CHANGE_REQUESTS_SPEC, {
        status: { label: t("status"), allLabel: t("allStatuses"), optionLabel: (s) => ts(s as ChangeStatus) },
        field: { label: t("field"), allLabel: t("allFields"), optionLabel: (f) => tf(f as ProtectedField) },
        from: { label: t("askedOn") },
        flagged: { label: t("flaggedOnly") },
      }),
    [t, ts, tf],
  )
  const table = useTableState(CHANGE_REQUESTS_SPEC)

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <TableToolbar table={table} filters={filters} search={{ label: t("search"), placeholder: t("searchPlaceholder") }} />
      <TableBoundary>
        <ChangeRequestsTable table={table} />
      </TableBoundary>
      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("detailsTitle")}>
        {(id) => <ChangeRequestDetails requestId={id} />}
      </DetailsDrawer>
    </div>
  )
}

function ChangeRequestsTable({ table }: { table: TableState }) {
  const t = useTranslations("AdminChangeRequests")
  const tf = useTranslations("ChangeRequests.fieldName")
  const tflag = useTranslations("AdminChangeRequests.flag")
  const format = useFormatter()
  const { filters } = table
  const pages = useTablePages(
    api.admin.changeRequests.list,
    {
      search: table.search || undefined,
      status: (filters.status || undefined) as ChangeStatus | undefined,
      field: (filters.field || undefined) as ProtectedField | undefined,
      flagged: filters.flagged === "1" || undefined,
      ...dayRange({ from: filters.from, to: filters.to }),
      order: table.search ? undefined : table.order,
    },
    table,
  )

  const flagText = (row: Row) =>
    row.flags.map((f) => (f === "brand" ? tflag("brand", { brand: row.matchedBrand ?? "" }) : tflag("cooldown"))).join(" · ")

  const columns: Column<Row>[] = [
    { id: "shop", header: t("shop"), cell: (r) => r.shopName, className: "max-w-44", mobile: "title" },
    { id: "field", header: t("field"), cell: (r) => tf(r.field), className: "whitespace-nowrap", mobile: "subtitle" },
    {
      id: "change",
      header: t("change"),
      mobileOnly: true,
      mobile: "meta",
      cell: (r) => `${displayValue(r.field, r.oldValue)} → ${displayValue(r.field, r.newValue)}`,
    },
    { id: "old", header: t("oldValue"), cell: (r) => displayValue(r.field, r.oldValue), muted: true, className: "max-w-44" },
    {
      id: "new",
      header: t("newValue"),
      cell: (r) => <span className="font-medium">{displayValue(r.field, r.newValue)}</span>,
      className: "max-w-44",
    },
    { id: "status", header: t("status"), cell: (r) => <StatusTag kind="change" status={r.status} />, mobile: "trailing" },
    {
      id: "asked",
      header: t("askedOn"),
      sortable: true,
      cell: (r) => format.dateTime(new Date(r._creationTime), { dateStyle: "medium" }),
      className: "whitespace-nowrap tabular-nums text-muted-foreground",
      hideBelow: "lg",
    },
    {
      id: "flag",
      header: t("flagColumn"),
      srOnlyHeader: true,
      className: "w-10",
      mobile: "trailing",
      cell: (r) =>
        r.flags.length > 0 ? (
          <span title={flagText(r)} className="inline-flex text-destructive">
            <AlertTriangleIcon className="size-4" aria-hidden />
            <span className="sr-only">{flagText(r)}</span>
          </span>
        ) : null,
    },
  ]

  return (
    <DataTable
      label={t("title")}
      columns={columns}
      rows={pages.rows}
      getRowId={(r) => r._id}
      loading={pages.loading}
      skeletonRows={table.size}
      empty={{ icon: <FilePenLineIcon />, title: t("emptyTitle"), body: t("emptyBody") }}
      onClearFilters={table.filtered ? table.clearFilters : undefined}
      onRowOpen={(r) => table.openRow(r._id)}
      activeRowId={table.open}
      sort={{ columnId: "asked", order: table.order, onChange: table.setOrder, disabled: table.search !== "" }}
      footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
    />
  )
}
