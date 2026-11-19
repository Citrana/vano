"use client"

import type { FunctionReturnType } from "convex/server"
import { StoreIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import { api } from "../../../../convex/_generated/api"
import type { Category } from "../../../../convex/lib/catalog"
import type { Currency } from "../../../../convex/lib/money"
import { PageTitle } from "@/components/shell/page-title"
import { countryName } from "@/features/shop/countries"
import { DataTable, TableBoundary } from "../data-table/data-table"
import { DetailsDrawer } from "../data-table/details-drawer"
import { filterDefs } from "../data-table/filters"
import { StatusTag } from "../data-table/status-tag"
import { TablePagination } from "../data-table/table-pagination"
import { TableToolbar } from "../data-table/table-toolbar"
import type { Column } from "../data-table/types"
import { useTablePages } from "../data-table/use-table-pages"
import { useTableState, type TableState } from "../data-table/use-table-state"
import { ShopDetails } from "./shop-details"
import { SHOPS_SPEC } from "./table-spec"

type Row = FunctionReturnType<typeof api.admin.shops.list>["page"][number]

/** /admin/shops: search by name, filter by status, category and currency; a row opens the shop drawer. */
export function ShopsSection() {
  const t = useTranslations("AdminShops")
  const ts = useTranslations("ShopStatus")
  const tc = useTranslations("Categories")
  const tm = useTranslations("Currencies")
  const filters = useMemo(
    () =>
      filterDefs(SHOPS_SPEC, {
        status: { label: t("status"), allLabel: t("allStatuses"), optionLabel: (s) => ts(s as "active" | "suspended") },
        category: { label: t("category"), allLabel: t("allCategories"), optionLabel: (c) => tc(c as Category) },
        currency: { label: t("currency"), allLabel: t("allCurrencies"), optionLabel: (c) => tm(c as Currency) },
      }),
    [t, ts, tc, tm],
  )
  const table = useTableState(SHOPS_SPEC)

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <TableToolbar table={table} filters={filters} search={{ label: t("search"), placeholder: t("searchPlaceholder") }} />
      <TableBoundary>
        <ShopsTable table={table} />
      </TableBoundary>
      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("detailsTitle")} wide>
        {(id) => <ShopDetails shopId={id} />}
      </DetailsDrawer>
    </div>
  )
}

function ShopsTable({ table }: { table: TableState }) {
  const t = useTranslations("AdminShops")
  const format = useFormatter()
  const locale = useLocale()
  const { filters } = table
  const pages = useTablePages(
    api.admin.shops.list,
    {
      search: table.search || undefined,
      status: (filters.status || undefined) as "active" | "suspended" | undefined,
      category: (filters.category || undefined) as Category | undefined,
      currency: (filters.currency || undefined) as Currency | undefined,
      order: table.search ? undefined : table.order,
    },
    table,
  )

  const columns: Column<Row>[] = [
    {
      id: "shop",
      header: t("shop"),
      className: "max-w-56",
      mobile: "title",
      cell: (r) => (
        <span className="flex flex-col">
          <span className="truncate">{r.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">/{r.slug}</span>
        </span>
      ),
    },
    { id: "owner", header: t("owner"), cell: (r) => r.ownerEmail, muted: true, className: "max-w-52", mobile: "subtitle" },
    { id: "status", header: t("status"), cell: (r) => <StatusTag kind="shop" status={r.status} />, mobile: "trailing" },
    {
      id: "place",
      header: t("place"),
      cell: (r) => `${r.city}, ${countryName(r.country, locale)}`,
      muted: true,
      className: "max-w-40",
      hideBelow: "lg",
      mobile: "meta",
    },
    { id: "currency", header: t("currency"), cell: (r) => r.currency, muted: true, hideBelow: "xl" },
    {
      id: "created",
      header: t("created"),
      sortable: true,
      cell: (r) => format.dateTime(new Date(r.createdAt), { dateStyle: "medium" }),
      className: "whitespace-nowrap tabular-nums text-muted-foreground",
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
      empty={{ icon: <StoreIcon />, title: t("emptyTitle"), body: t("emptyBody") }}
      onClearFilters={table.filtered ? table.clearFilters : undefined}
      onRowOpen={(r) => table.openRow(r._id)}
      activeRowId={table.open}
      sort={{ columnId: "created", order: table.order, onChange: table.setOrder, disabled: table.search !== "" }}
      footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
    />
  )
}
