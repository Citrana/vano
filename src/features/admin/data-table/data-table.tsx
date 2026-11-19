"use client"

import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Fragment, type KeyboardEvent, type ReactNode } from "react"
import { cn } from "cn"
import { EmptyState, ErrorState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import type { Column } from "./types"
import type { SortOrder } from "./url-state"

export type DataTableSort = {
  columnId: string
  order: SortOrder
  onChange: (order: SortOrder) => void
  /** Search results come back by relevance: sorting is off while searching. */
  disabled?: boolean
}

export type DataTableSelection = {
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  /** Bulk actions for the selected ids, shown in a bar above the table. */
  actions: (ids: string[]) => ReactNode
}

export type DataTableProps<Row> = {
  /** Accessible name of the table (visually hidden caption). */
  label: string
  columns: readonly Column<Row>[]
  rows: readonly Row[]
  getRowId: (row: Row) => string
  loading: boolean
  skeletonRows?: number
  empty: { icon?: ReactNode; title: string; body?: string }
  /** Shows "Clear all filters" in the empty state. */
  onClearFilters?: () => void
  onRowOpen: (row: Row) => void
  /** The row whose drawer is open (highlighted). */
  activeRowId?: string | null
  sort?: DataTableSort
  selection?: DataTableSelection
  /** Pagination, under the rows. */
  footer?: ReactNode
}

const HIDE_BELOW = { lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const

/**
 * The one admin list (CLAUDE.md "UI"): a real table from `md` (sticky
 * header, compact rows, thin dividers) and stacked items on phones. A
 * row is one tab stop (a button in its first cell that covers the row);
 * arrow keys move between rows, Enter opens the drawer.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const { rows, loading, empty, onClearFilters, footer } = props
  const t = useTranslations("DataTable")

  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        body={empty.body}
        action={
          onClearFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              {t("clearAll")}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {props.selection && props.selection.selected.size > 0 ? <BulkBar selection={props.selection} /> : null}
      <div className="rounded-xl border bg-card overflow-x-clip">
        <DesktopTable {...props} />
        <MobileList {...props} />
      </div>
      {loading ? (
        <span role="status" className="sr-only">
          {t("loading")}
        </span>
      ) : null}
      {footer}
    </div>
  )
}

/** The error state for a list whose query failed; Retry subscribes again. */
export function TableBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} className="rounded-xl border bg-card" />}>
      {children}
    </QueryBoundary>
  )
}

/** Arrow keys move focus between the row buttons inside `container`. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
  const target = event.target as HTMLElement
  if (!target.matches("[data-row-button]")) return
  const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-row-button]")]
  const next = buttons[buttons.indexOf(target) + (event.key === "ArrowDown" ? 1 : -1)]
  if (next) {
    event.preventDefault()
    next.focus()
  }
}

function DesktopTable<Row>({
  label,
  columns,
  rows,
  getRowId,
  loading,
  skeletonRows = 10,
  onRowOpen,
  activeRowId,
  sort,
  selection,
}: DataTableProps<Row>) {
  const t = useTranslations("DataTable")
  const pageIds = rows.map(getRowId)
  const selectedOnPage = selection ? pageIds.filter((id) => selection.selected.has(id)).length : 0

  return (
    <table className="hidden w-full text-sm md:table">
      <caption className="sr-only">{label}</caption>
      <thead className="sticky top-14 z-10 bg-card">
        <tr className="border-b text-left text-xs text-muted-foreground">
          {selection ? (
            <th scope="col" className="w-11 px-3">
              <Checkbox
                aria-label={t("selectPage")}
                checked={pageIds.length > 0 && selectedOnPage === pageIds.length}
                indeterminate={selectedOnPage > 0 && selectedOnPage < pageIds.length}
                onCheckedChange={(checked) => {
                  const next = new Set(selection.selected)
                  for (const id of pageIds) {
                    if (checked) next.add(id)
                    else next.delete(id)
                  }
                  selection.onChange(next)
                }}
              />
            </th>
          ) : null}
          {columns.map((col) => (
            <HeaderCell key={col.id} column={col} sort={sort} />
          ))}
          <th scope="col" className="w-8">
            <span className="sr-only">{t("open")}</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y" onKeyDown={moveFocus}>
        {loading
          ? Array.from({ length: Math.min(skeletonRows, 10) }, (_, i) => (
              <tr key={i} className="h-12">
                {selection ? <td className="px-3" /> : null}
                {columns.map((col) => (
                  <td key={col.id} className={cn("px-3", col.hideBelow && HIDE_BELOW[col.hideBelow])}>
                    <Skeleton className="h-3.5 w-3/4 max-w-40 rounded-sm" />
                  </td>
                ))}
                <td />
              </tr>
            ))
          : rows.map((row) => {
              const id = getRowId(row)
              const selected = selection?.selected.has(id) ?? false
              return (
                <tr
                  key={id}
                  aria-selected={selection ? selected : undefined}
                  className={cn(
                    "group relative h-12 transition-colors hover:bg-muted/50 has-[[data-row-button]:focus-visible]:bg-muted/50",
                    (id === activeRowId || selected) && "bg-secondary/60 hover:bg-secondary/60",
                  )}
                >
                  {selection ? (
                    <td className="relative z-[1] w-11 px-3">
                      <Checkbox
                        aria-label={t("selectRow")}
                        checked={selected}
                        onCheckedChange={(checked) => {
                          const next = new Set(selection.selected)
                          if (checked) next.add(id)
                          else next.delete(id)
                          selection.onChange(next)
                        }}
                      />
                    </td>
                  ) : null}
                  {columns.map((col, i) => (
                    <td
                      key={col.id}
                      className={cn(
                        "px-3 py-2 align-middle",
                        col.align === "end" && "text-right",
                        col.muted && "text-muted-foreground",
                        col.hideBelow && HIDE_BELOW[col.hideBelow],
                        col.className,
                      )}
                    >
                      {i === 0 ? (
                        <button
                          type="button"
                          data-row-button
                          onClick={() => onRowOpen(row)}
                          className="block max-w-full truncate text-left font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring"
                        >
                          {col.cell(row)}
                        </button>
                      ) : (
                        <div className="truncate">{col.cell(row)}</div>
                      )}
                    </td>
                  ))}
                  <td className="w-8 pr-3 text-muted-foreground">
                    <ChevronRightIcon className="size-4" aria-hidden />
                  </td>
                </tr>
              )
            })}
      </tbody>
    </table>
  )
}

function HeaderCell<Row>({ column, sort }: { column: Column<Row>; sort?: DataTableSort }) {
  const t = useTranslations("DataTable")
  const sorted = sort && column.sortable && sort.columnId === column.id && !sort.disabled
  const className = cn(
    "h-10 px-3 font-medium whitespace-nowrap",
    column.align === "end" && "text-right",
    column.hideBelow && HIDE_BELOW[column.hideBelow],
    column.className,
  )
  const header = column.srOnlyHeader ? <span className="sr-only">{column.header}</span> : column.header

  if (!sorted) {
    return (
      <th scope="col" className={className}>
        {header}
      </th>
    )
  }
  const Arrow = sort.order === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <th scope="col" className={className} aria-sort={sort.order === "asc" ? "ascending" : "descending"}>
      <button
        type="button"
        onClick={() => sort.onChange(sort.order === "asc" ? "desc" : "asc")}
        className="focus-ring -mx-1.5 inline-flex h-8 items-center gap-1 rounded-sm px-1.5 font-semibold text-foreground hover:bg-muted"
      >
        {header}
        <Arrow className="size-3.5" aria-hidden />
        <span className="sr-only">{t("toggleSort")}</span>
      </button>
    </th>
  )
}

function MobileList<Row>({ columns, rows, getRowId, loading, skeletonRows = 10, onRowOpen, activeRowId, selection }: DataTableProps<Row>) {
  const t = useTranslations("DataTable")
  const pick = (slot: NonNullable<Column<Row>["mobile"]>) => columns.filter((c) => c.mobile === slot)

  if (loading) {
    return (
      <ul className="divide-y md:hidden" aria-hidden>
        {Array.from({ length: Math.min(skeletonRows, 6) }, (_, i) => (
          <li key={i} className="flex flex-col gap-2 px-4 py-3">
            <Skeleton className="h-4 w-1/2 rounded-sm" />
            <Skeleton className="h-3 w-3/4 rounded-sm" />
          </li>
        ))}
      </ul>
    )
  }

  const [title, subtitle, meta, trailing] = (["title", "subtitle", "meta", "trailing"] as const).map(pick)
  return (
    <ul className="divide-y md:hidden" onKeyDown={moveFocus}>
      {rows.map((row) => {
        const id = getRowId(row)
        const selected = selection?.selected.has(id) ?? false
        return (
          <li key={id} className={cn("flex items-stretch", (id === activeRowId || selected) && "bg-secondary/60")}>
            {selection ? (
              <label className="flex w-11 shrink-0 items-center justify-center">
                <Checkbox
                  aria-label={t("selectRow")}
                  checked={selected}
                  onCheckedChange={(checked) => {
                    const next = new Set(selection.selected)
                    if (checked) next.add(id)
                    else next.delete(id)
                    selection.onChange(next)
                  }}
                />
              </label>
            ) : null}
            <button
              type="button"
              data-row-button
              onClick={() => onRowOpen(row)}
              className={cn(
                "flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pr-3 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                selection ? "pl-1" : "pl-4",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{title.map((c) => <Fragment key={c.id}>{c.cell(row)}</Fragment>)}</span>
                {subtitle.length > 0 ? (
                  <span className="truncate text-sm">{joinCells(subtitle, row)}</span>
                ) : null}
                {meta.length > 0 ? (
                  <span className="truncate text-xs text-muted-foreground">{joinCells(meta, row)}</span>
                ) : null}
              </span>
              {trailing.length > 0 ? (
                <span className="flex shrink-0 items-center gap-1.5">{trailing.map((c) => <Fragment key={c.id}>{c.cell(row)}</Fragment>)}</span>
              ) : null}
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Mobile line: the slot's cells joined by " · ". */
function joinCells<Row>(cols: Column<Row>[], row: Row): ReactNode {
  return cols.map((c, i) => (
    <Fragment key={c.id}>
      {i > 0 ? " · " : null}
      {c.cell(row)}
    </Fragment>
  ))
}

function BulkBar({ selection }: { selection: DataTableSelection }) {
  const t = useTranslations("DataTable")
  const ids = [...selection.selected]
  return (
    <div
      role="region"
      aria-label={t("bulkActions")}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
    >
      <span className="text-sm font-medium" aria-live="polite">
        {t("selectedCount", { count: ids.length })}
      </span>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        {selection.actions(ids)}
        <Button variant="ghost" size="sm" onClick={() => selection.onChange(new Set())}>
          {t("clearSelection")}
        </Button>
      </div>
    </div>
  )
}
