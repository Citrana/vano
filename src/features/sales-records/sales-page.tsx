"use client"

import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { PlusIcon, ReceiptTextIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import type { Currency } from "../../../convex/lib/money"
import type { RecordStatus, SaleSource } from "../../../convex/lib/salesRecords/validators"
import { shopTimeZone } from "../../../convex/lib/timeZone"
import { DataTable, TableBoundary } from "@/components/data-table/data-table"
import { DetailsDrawer } from "@/components/data-table/details-drawer"
import { filterDefs } from "@/components/data-table/filters"
import { TablePagination } from "@/components/data-table/table-pagination"
import { TableToolbar } from "@/components/data-table/table-toolbar"
import { useLocalPages } from "@/components/data-table/use-table-pages"
import { useTableState, type TableState } from "@/components/data-table/use-table-state"
import { PageTitle } from "@/components/shell/page-title"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { PickProductDialog } from "./pick-product-dialog"
import { RecordSaleDialog } from "./record-sale-dialog"
import { SaleDetails } from "./sale-details"
import { useSaleColumns } from "./sale-columns"
import { SalesLock } from "./sales-lock"
import { SALES_SPEC } from "./table-spec"
import { useRecordLabels } from "./use-record-labels"
import { useSalesAccess } from "./use-sales-access"

type ListResult = FunctionReturnType<typeof api.salesRecords.listMine>
type Unlocked = Extract<ListResult, { locked: false }>

/**
 * The seller's Sales page (CLAUDE.md "Sales tracking"): the shared list
 * (search, Filters with chips, numbered pages, date sort, details drawer;
 * everything in the address), with the totals of the filtered list above
 * it. Days are in the shop's time zone. Without `salesReports`: the lock
 * card.
 */
export function SalesPage() {
  const shop = useQuery(api.shops.myShop, {})
  const table = useTableState(SALES_SPEC)
  if (shop === undefined) return <LoadingState />
  if (shop === null) return null
  return <SalesList currency={shop.currency} timeZone={shopTimeZone(shop)} table={table} />
}

function SalesList({ currency, timeZone, table }: { currency: Currency; timeZone: string; table: TableState }) {
  const t = useTranslations("SalesRecords")
  const access = useSalesAccess()
  const [picking, setPicking] = useState(false)
  const [recording, setRecording] = useState<Id<"products"> | null>(null)
  const { filters } = table
  const data = useQuery(api.salesRecords.listMine, {
    from: filters.from || undefined,
    to: filters.to || undefined,
    source: (filters.source || undefined) as SaleSource | undefined,
    status: (filters.status || undefined) as RecordStatus | undefined,
    productId: filters.product || undefined,
    search: table.search || undefined,
    order: table.order,
  })
  // Keep the last result on screen while a new filter loads (no flash).
  const [last, setLast] = useState<ListResult | undefined>(data)
  if (data !== undefined && data !== last) setLast(data)
  const shown = data ?? last
  const unlocked = shown && !shown.locked ? shown : undefined

  const filterList = useMemo(
    () =>
      filterDefs(SALES_SPEC, {
        from: { label: t("filters.range"), timeZone },
        source: { label: t("filters.source"), allLabel: t("filters.allSources"), optionLabel: (s) => t(`sources.${s as SaleSource}`) },
        status: { label: t("filters.status"), allLabel: t("filters.allStatuses"), optionLabel: (s) => t(`status.${s as RecordStatus}`) },
        product: {
          label: t("filters.product"),
          allLabel: t("filters.allProducts"),
          options: (unlocked?.products ?? []).map((p) => ({ value: p.id, label: p.name })),
        },
      }),
    [t, timeZone, unlocked?.products],
  )

  if (shown === undefined) return <LoadingState />
  if (shown.locked) {
    return (
      <div className="flex flex-col gap-5">
        <PageTitle title={t("title")} />
        <SalesLock kept={shown.kept} currency={currency} />
      </div>
    )
  }

  const canRecord = access.allowed && !access.locked
  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        title={t("title")}
        action={
          canRecord ? (
            <Button onClick={() => setPicking(true)}>
              <PlusIcon />
              {t("record")}
            </Button>
          ) : null
        }
      />
      <TableToolbar
        table={table}
        filters={filterList}
        search={{
          label: t("filters.search"),
          placeholder: shown.canSeeCustomers ? t("filters.searchPlaceholder") : t("filters.searchPlaceholderProduct"),
        }}
      />
      <Totals totals={shown.totals} currency={currency} timeZone={timeZone} />
      {shown.truncated ? <p className="text-xs text-muted-foreground">{t("truncated", { count: shown.rows.length })}</p> : null}
      <TableBoundary>
        <SalesTable data={shown} loading={data === undefined} table={table} />
      </TableBoundary>

      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("details.title")}>
        {(id) => <SaleDetails recordId={id} />}
      </DetailsDrawer>
      <PickProductDialog
        open={picking}
        onOpenChange={setPicking}
        currency={currency}
        onPick={(id) => {
          setPicking(false)
          setRecording(id)
        }}
      />
      <RecordSaleDialog productId={recording} open={recording !== null} onOpenChange={(open) => (open ? null : setRecording(null))} />
    </div>
  )
}

function SalesTable({ data, loading, table }: { data: Unlocked; loading: boolean; table: TableState }) {
  const t = useTranslations("SalesRecords")
  const columns = useSaleColumns({ currency: data.currency, timeZone: data.timeZone, canSeeCustomers: data.canSeeCustomers })
  const pages = useLocalPages(loading ? undefined : data.rows, table)
  return (
    <DataTable
      label={t("title")}
      columns={columns}
      rows={pages.rows}
      getRowId={(r) => r._id}
      loading={pages.loading}
      skeletonRows={table.size}
      empty={{
        icon: <ReceiptTextIcon />,
        title: table.filtered ? t("emptyFilter") : t("emptyTitle"),
        body: table.filtered ? undefined : t("emptyBody"),
      }}
      onClearFilters={table.filtered ? table.clearFilters : undefined}
      onRowOpen={(r) => table.openRow(r._id)}
      activeRowId={table.open}
      sort={{ columnId: "date", order: table.order, onChange: table.setOrder }}
      footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
    />
  )
}

function Totals({
  totals,
  currency,
  timeZone,
}: {
  totals: Unlocked["totals"]
  currency: Currency
  timeZone: string
}) {
  const t = useTranslations("SalesRecords.totals")
  const labels = useRecordLabels(currency, timeZone)
  const tiles = [
    [t("sales"), String(totals.count)],
    [t("items"), String(totals.items)],
    [t("revenue"), labels.money(totals.revenue)],
    [t("discounts"), labels.money(totals.discounts)],
  ]
  return (
    <dl aria-label={t("label")} className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="truncate text-lg font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
