"use client"

import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { PlusIcon, ShieldCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../../convex/_generated/api"
import { ALL_PERMISSIONS } from "../../../../convex/lib/permissions"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { DataTable, TableBoundary } from "@/components/data-table/data-table"
import { DetailsDrawer } from "@/components/data-table/details-drawer"
import { TablePagination } from "@/components/data-table/table-pagination"
import { TableToolbar } from "@/components/data-table/table-toolbar"
import type { Column } from "@/components/data-table/types"
import { useLocalPages } from "@/components/data-table/use-table-pages"
import { useTableState, type TableState } from "@/components/data-table/use-table-state"
import { useAdminViewer, useRoleLabel } from "../shell/use-admin-viewer"
import { RoleDetails } from "./role-details"
import { ROLES_SPEC } from "./table-spec"

type Row = FunctionReturnType<typeof api.admin.roles.list>[number]

/** /admin/roles: built-in roles first, then custom roles; a row opens the role (edit or read-only). */
export function RolesSection() {
  const t = useTranslations("AdminRoles")
  const { viewer } = useAdminViewer()
  const table = useTableState(ROLES_SPEC)
  const canManage = viewer?.permissions.includes("roles.manage") ?? false

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        title={t("title")}
        action={
          canManage ? (
            <Link href="/admin/roles/new" className={buttonVariants()}>
              <PlusIcon />
              {t("newRole")}
            </Link>
          ) : null
        }
      />
      <TableToolbar table={table} filters={[]} search={{ label: t("search"), placeholder: t("searchPlaceholder") }} />
      <TableBoundary>
        <RolesTable table={table} />
      </TableBoundary>
      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("roleTitle")} wide>
        {(id) => <RoleDetails roleId={id} />}
      </DetailsDrawer>
    </div>
  )
}

function RolesTable({ table }: { table: TableState }) {
  const t = useTranslations("AdminRoles")
  const roleLabel = useRoleLabel()
  const roles = useQuery(api.admin.roles.list, {})
  const search = table.search.toLowerCase()
  const matching = roles?.filter((r) => !search || roleLabel(r).toLowerCase().includes(search))
  const pages = useLocalPages(matching, table)

  const columns: Column<Row>[] = [
    {
      id: "role",
      header: t("name"),
      className: "max-w-60",
      mobile: "title",
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span className="truncate">{roleLabel(r)}</span>
          {r.key ? <Badge variant="muted">{t("builtIn")}</Badge> : null}
        </span>
      ),
    },
    { id: "description", header: t("description"), cell: (r) => r.description ?? "—", muted: true, className: "max-w-80", hideBelow: "lg" },
    {
      id: "permissions",
      header: t("permissions"),
      mobile: "subtitle",
      cell: (r) => (r.permissions.length === ALL_PERMISSIONS.length ? t("allPermissions") : t("permissionCount", { count: r.permissions.length })),
    },
    {
      id: "users",
      header: t("users"),
      align: "end",
      muted: true,
      mobile: "meta",
      cell: (r) => (r.userCountCapped ? t("userCountMany") : t("userCount", { count: r.userCount })),
    },
  ]

  return (
    <>
      <DataTable
        label={t("title")}
        columns={columns}
        rows={pages.rows}
        getRowId={(r) => r._id}
        loading={pages.loading}
        skeletonRows={5}
        empty={{ icon: <ShieldCheckIcon />, title: t("noMatchTitle"), body: t("noMatchBody") }}
        onClearFilters={table.filtered ? table.clearFilters : undefined}
        onRowOpen={(r) => table.openRow(r._id)}
        activeRowId={table.open}
        footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
      />
      {/* Built-in roles always exist: invite to create the first custom one. */}
      {roles && !search && !roles.some((r) => r.key === null) ? (
        <EmptyState icon={<ShieldCheckIcon />} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : null}
    </>
  )
}
