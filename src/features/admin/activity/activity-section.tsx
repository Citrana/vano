"use client"

import { useQuery } from "convex/react"
import { HistoryIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { AuditAction } from "../../../../convex/lib/audit"
import { PageTitle } from "@/components/shell/page-title"
import { DataTable, TableBoundary } from "@/components/data-table/data-table"
import { DetailsDrawer } from "@/components/data-table/details-drawer"
import { filterDefs } from "@/components/data-table/filters"
import { TablePagination } from "@/components/data-table/table-pagination"
import { TableToolbar } from "@/components/data-table/table-toolbar"
import type { Column } from "@/components/data-table/types"
import { useTablePages } from "@/components/data-table/use-table-pages"
import { useTableState, type TableState } from "@/components/data-table/use-table-state"
import { dayRange } from "@/components/data-table/url-state"
import { ActivityDetails, useActorLabel, type ActivityEntry } from "./activity-details"
import { ACTIVITY_SPEC } from "./table-spec"

type Actor = { _id: Id<"users">; email: string }

/** /admin/activity: who did what, to whom, when — newest first; a row opens the full entry. */
export function ActivitySection() {
  const t = useTranslations("AdminActivity")
  const ta = useTranslations("AuditActions")
  const actors = useQuery(api.admin.audit.actors, {})
  const filters = useMemo(
    () =>
      filterDefs(ACTIVITY_SPEC, {
        actor: {
          label: t("person"),
          allLabel: t("allPeople"),
          options: [{ value: "system", label: t("system") }, ...(actors ?? []).map((a) => ({ value: a._id, label: a.email }))],
        },
        action: { label: t("action"), allLabel: t("allActions"), optionLabel: (a) => ta(a as AuditAction) },
        from: { label: t("when") },
      }),
    [t, ta, actors],
  )
  const table = useTableState(ACTIVITY_SPEC)

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <TableToolbar table={table} filters={filters} />
      <TableBoundary>
        <ActivityTable table={table} actors={actors} />
      </TableBoundary>
      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("entryTitle")}>
        {(id) => <ActivityDetails entryId={id} />}
      </DetailsDrawer>
    </div>
  )
}

function ActivityTable({ table, actors }: { table: TableState; actors: Actor[] | undefined }) {
  const t = useTranslations("AdminActivity")
  const ta = useTranslations("AuditActions")
  const format = useFormatter()
  const actorLabel = useActorLabel()
  const { filters } = table
  // A person id from the URL is only sent once it's known (the server validates ids strictly).
  const actor =
    filters.actor === "system" ? ("system" as const) : actors?.find((a) => a._id === filters.actor)?._id
  const waitForActors = filters.actor !== "" && filters.actor !== "system" && actors === undefined
  const pages = useTablePages(
    api.admin.audit.list,
    waitForActors
      ? "skip"
      : {
          actor,
          action: (filters.action || undefined) as AuditAction | undefined,
          ...dayRange({ from: filters.from, to: filters.to }),
          order: table.order,
        },
    table,
  )

  const columns: Column<ActivityEntry>[] = [
    { id: "action", header: t("action"), cell: (e) => ta(e.action), className: "max-w-56", mobile: "title" },
    { id: "person", header: t("person"), cell: actorLabel, muted: true, className: "max-w-52", mobile: "subtitle" },
    { id: "target", header: t("target"), cell: (e) => e.targetLabel, className: "max-w-72", hideBelow: "lg" },
    {
      id: "when",
      header: t("when"),
      sortable: true,
      cell: (e) => format.dateTime(new Date(e.at), { dateStyle: "medium", timeStyle: "short" }),
      className: "whitespace-nowrap tabular-nums text-muted-foreground",
      mobile: "meta",
    },
  ]

  return (
    <DataTable
      label={t("title")}
      columns={columns}
      rows={pages.rows}
      getRowId={(e) => e._id}
      loading={pages.loading}
      skeletonRows={table.size}
      empty={{
        icon: <HistoryIcon />,
        title: table.filtered ? t("emptyFilteredTitle") : t("emptyTitle"),
        body: table.filtered ? t("emptyFilteredBody") : t("emptyBody"),
      }}
      onClearFilters={table.filtered ? table.clearFilters : undefined}
      onRowOpen={(e) => table.openRow(e._id)}
      activeRowId={table.open}
      sort={{ columnId: "when", order: table.order, onChange: table.setOrder }}
      footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
    />
  )
}
