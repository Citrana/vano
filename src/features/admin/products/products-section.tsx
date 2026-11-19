"use client"

import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { EyeIcon, EyeOffIcon, ImageIcon, PackageIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { Category } from "../../../../convex/lib/catalog"
import { formatMoney } from "../../../../convex/lib/money"
import { PageTitle } from "@/components/shell/page-title"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useErrorMessage } from "@/lib/use-error-message"
import { DataTable, TableBoundary } from "../data-table/data-table"
import { DetailsDrawer } from "../data-table/details-drawer"
import { filterDefs } from "../data-table/filters"
import { StatusTag } from "../data-table/status-tag"
import { TablePagination } from "../data-table/table-pagination"
import { TableToolbar } from "../data-table/table-toolbar"
import type { Column } from "../data-table/types"
import { useTablePages } from "../data-table/use-table-pages"
import { useTableState, type TableState } from "../data-table/use-table-state"
import { useAdminViewer } from "../shell/use-admin-viewer"
import { ProductDetails } from "./product-details"
import { PRODUCTS_SPEC } from "./table-spec"

type Row = FunctionReturnType<typeof api.admin.products.list>["page"][number]

/**
 * /admin/products: search, filter by visibility and category; a row opens
 * the product drawer. With `products.hide`, rows can be selected to hide
 * or show several at once.
 */
export function ProductsSection() {
  const t = useTranslations("AdminProducts")
  const tc = useTranslations("Categories")
  const filters = useMemo(
    () =>
      filterDefs(PRODUCTS_SPEC, {
        visibility: { label: t("visibility"), allLabel: t("allVisibility"), optionLabel: (v) => t(v as "visible" | "hidden") },
        category: { label: t("category"), allLabel: t("allCategories"), optionLabel: (c) => tc(c as Category) },
      }),
    [t, tc],
  )
  const table = useTableState(PRODUCTS_SPEC)

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <TableToolbar table={table} filters={filters} search={{ label: t("search"), placeholder: t("searchPlaceholder") }} />
      <TableBoundary>
        <ProductsTable table={table} />
      </TableBoundary>
      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("detailsTitle")}>
        {(id) => <ProductDetails productId={id} />}
      </DetailsDrawer>
    </div>
  )
}

function ProductsTable({ table }: { table: TableState }) {
  const t = useTranslations("AdminProducts")
  const tc = useTranslations("Categories")
  const format = useFormatter()
  const locale = useLocale()
  const { viewer } = useAdminViewer()
  const canHide = viewer?.permissions.includes("products.hide") ?? false
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const { filters } = table
  const pages = useTablePages(
    api.admin.products.list,
    {
      search: table.search || undefined,
      visibility: (filters.visibility || undefined) as "visible" | "hidden" | undefined,
      category: (filters.category || undefined) as Category | undefined,
      order: table.search ? undefined : table.order,
    },
    table,
  )

  const columns: Column<Row>[] = [
    {
      id: "product",
      header: t("product"),
      className: "max-w-72",
      mobile: "title",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="hidden size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted md:flex">
            {r.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
              <img src={r.coverUrl} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
            )}
          </span>
          <span className="truncate">{r.name}</span>
        </span>
      ),
    },
    { id: "shop", header: t("shop"), cell: (r) => r.shop.name, muted: true, className: "max-w-48", mobile: "subtitle" },
    {
      id: "price",
      header: t("price"),
      align: "end",
      cell: (r) => formatMoney(r.price, r.shop.currency, locale),
      className: "whitespace-nowrap tabular-nums",
      mobile: "meta",
    },
    { id: "category", header: t("category"), cell: (r) => tc(r.category), muted: true, hideBelow: "lg", mobile: "meta" },
    {
      id: "status",
      header: t("visibility"),
      mobile: "trailing",
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <StatusTag kind="visibility" status={r.hidden ? "hidden" : "visible"} />
          {r.soldOut ? <Badge variant="muted" className="hidden xl:inline-flex">{t("soldOut")}</Badge> : null}
        </span>
      ),
    },
    {
      id: "added",
      header: t("added"),
      sortable: true,
      cell: (r) => format.dateTime(new Date(r.createdAt), { dateStyle: "medium" }),
      className: "whitespace-nowrap tabular-nums text-muted-foreground",
      hideBelow: "xl",
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
      empty={{ icon: <PackageIcon />, title: t("emptyTitle"), body: t("emptyBody") }}
      onClearFilters={table.filtered ? table.clearFilters : undefined}
      onRowOpen={(r) => table.openRow(r._id)}
      activeRowId={table.open}
      sort={{ columnId: "added", order: table.order, onChange: table.setOrder, disabled: table.search !== "" }}
      selection={
        canHide
          ? {
              selected,
              onChange: setSelected,
              actions: (ids) => <BulkVisibility ids={ids} onDone={() => setSelected(new Set())} />,
            }
          : undefined
      }
      footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
    />
  )
}

/** Hide or show the selected products: one `setHidden` call each, so every change is checked and logged. */
function BulkVisibility({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const t = useTranslations("AdminProducts")
  const setHidden = useMutation(api.admin.products.setHidden)
  const errorMessage = useErrorMessage()
  const [pending, setPending] = useState(false)

  async function apply(hidden: boolean) {
    setPending(true)
    let done = 0
    try {
      for (const id of ids) {
        await setHidden({ productId: id as Id<"products">, hidden })
        done += 1
      }
      toast.success(hidden ? t("bulkHidden", { count: done }) : t("bulkShown", { count: done }))
      onDone()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => apply(true)}>
        <EyeOffIcon />
        {t("bulkHide")}
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => apply(false)}>
        <EyeIcon />
        {t("bulkShow")}
      </Button>
    </>
  )
}
