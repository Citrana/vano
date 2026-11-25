"use client"

import { useQuery } from "convex/react"
import { UsersIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { PageTitle } from "@/components/shell/page-title"
import { DataTable, TableBoundary } from "@/components/data-table/data-table"
import { DetailsDrawer } from "@/components/data-table/details-drawer"
import { filterDefs } from "@/components/data-table/filters"
import { StatusTag } from "@/components/data-table/status-tag"
import { TablePagination } from "@/components/data-table/table-pagination"
import { TableToolbar } from "@/components/data-table/table-toolbar"
import type { Column } from "@/components/data-table/types"
import { useTablePages } from "@/components/data-table/use-table-pages"
import { useTableState, type TableState } from "@/components/data-table/use-table-state"
import { useRoleLabel } from "../shell/use-admin-viewer"
import { USERS_SPEC } from "./table-spec"
import { UserDetails } from "./user-details"

type Row = {
  _id: Id<"users">
  email: string
  roleKey: "super_admin" | "seller" | null
  roleName: string
  status: "active" | "suspended"
  createdAt: number
  shopName: string | null
}
type RoleOption = { _id: Id<"roles">; key: "super_admin" | "seller" | null; name: string }

/** /admin/users: search by email, filter by role and status; a row opens the user drawer. */
export function UsersSection() {
  const t = useTranslations("AdminUsers")
  const ts = useTranslations("UserStatus")
  const roleLabel = useRoleLabel()
  const roles = useQuery(api.admin.users.roleOptions, {})
  const filters = useMemo(
    () =>
      filterDefs(USERS_SPEC, {
        roleId: {
          label: t("role"),
          allLabel: t("allRoles"),
          options: (roles ?? []).map((r) => ({ value: r._id, label: roleLabel(r) })),
        },
        status: { label: t("status"), allLabel: t("allStatuses"), optionLabel: (s) => ts(s as "active" | "suspended") },
      }),
    // roleLabel is rebuilt every render; its output only depends on `roles` and the locale (t).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, ts, roles],
  )
  const table = useTableState(USERS_SPEC)

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <TableToolbar table={table} filters={filters} search={{ label: t("search"), placeholder: t("searchPlaceholder") }} />
      <TableBoundary>
        <UsersTable table={table} roles={roles} />
      </TableBoundary>
      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("detailsTitle")}>
        {(id) => <UserDetails userId={id} />}
      </DetailsDrawer>
    </div>
  )
}

function UsersTable({ table, roles }: { table: TableState; roles: RoleOption[] | undefined }) {
  const t = useTranslations("AdminUsers")
  const format = useFormatter()
  const roleLabel = useRoleLabel()
  const { filters } = table
  // A role id from the URL is only sent once it's known to exist (the server validates ids strictly).
  const roleId = filters.roleId ? roles?.find((r) => r._id === filters.roleId)?._id : undefined
  const waitForRoles = filters.roleId !== "" && roles === undefined
  const pages = useTablePages(
    api.admin.users.list,
    waitForRoles
      ? "skip"
      : {
          search: table.search || undefined,
          roleId,
          status: (filters.status || undefined) as "active" | "suspended" | undefined,
          order: table.search ? undefined : table.order,
        },
    table,
  )

  const columns: Column<Row>[] = [
    { id: "email", header: t("email"), cell: (r) => r.email, className: "max-w-64", mobile: "title" },
    { id: "role", header: t("role"), cell: (r) => roleLabel(r), mobile: "subtitle" },
    { id: "status", header: t("status"), cell: (r) => <StatusTag kind="user" status={r.status} />, mobile: "trailing" },
    { id: "shop", header: t("shop"), cell: (r) => r.shopName ?? t("noShop"), muted: true, className: "max-w-48", mobile: "meta" },
    {
      id: "joined",
      header: t("joined"),
      sortable: true,
      cell: (r) => format.dateTime(new Date(r.createdAt), { dateStyle: "medium" }),
      className: "whitespace-nowrap tabular-nums text-muted-foreground",
      hideBelow: "lg",
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
      empty={{ icon: <UsersIcon />, title: t("emptyTitle"), body: t("emptyBody") }}
      onClearFilters={table.filtered ? table.clearFilters : undefined}
      onRowOpen={(r) => table.openRow(r._id)}
      activeRowId={table.open}
      sort={{ columnId: "joined", order: table.order, onChange: table.setOrder, disabled: table.search !== "" }}
      footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
    />
  )
}
