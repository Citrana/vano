"use client"

import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { DateRangeFilter, useRangeLabel } from "./date-range-filter"
import type { FilterDef } from "./types"
import type { TableState } from "./use-table-state"
import { ALL, PAGE_SIZES, defaultFilters } from "./url-state"

const SEARCH_DELAY_MS = 300

/**
 * Search on the left, "Filters" on the right, active filters as
 * removable chips underneath. Everything writes to the URL.
 */
export function TableToolbar({
  table,
  filters,
  search,
}: {
  table: TableState
  filters: readonly FilterDef[]
  search?: { label: string; placeholder: string }
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {search ? <SearchBox table={table} {...search} /> : <div className="flex-1" />}
        {filters.length > 0 ? <FiltersButton table={table} filters={filters} /> : null}
      </div>
      <FilterChips table={table} filters={filters} />
    </div>
  )
}

function SearchBox({ table, label, placeholder }: { table: TableState; label: string; placeholder: string }) {
  const [text, setText] = useState(table.search)
  const written = useRef(table.search)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // The URL changed from elsewhere (Clear all, a link): show it.
  useEffect(() => {
    if (table.search !== written.current) {
      written.current = table.search
      setText(table.search)
    }
  }, [table.search])
  useEffect(() => () => clearTimeout(timer.current), [])

  const { setSearch } = table
  return (
    <label className="relative min-w-0 flex-1 sm:max-w-sm">
      <span className="sr-only">{label}</span>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={text}
        placeholder={placeholder}
        className="pl-9"
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            written.current = next.trim()
            setSearch(next.trim())
          }, SEARCH_DELAY_MS)
        }}
      />
    </label>
  )
}

function FiltersButton({ table, filters }: { table: TableState; filters: readonly FilterDef[] }) {
  const t = useTranslations("DataTable")
  const count = table.activeFilters
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" className="ml-auto shrink-0" />}>
        <SlidersHorizontalIcon />
        <span className="sr-only sm:not-sr-only">{t("filters")}</span>
        {count > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[0.7rem] font-semibold text-background tabular-nums">
            {count}
            <span className="sr-only"> {t("filtersActive", { count })}</span>
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-center justify-between gap-2">
          <PopoverTitle>{t("filters")}</PopoverTitle>
          {table.filtered ? (
            <Button variant="ghost" size="sm" onClick={table.clearFilters}>
              {t("clearAll")}
            </Button>
          ) : null}
        </div>
        {filters.map((f) => (
          <FilterField key={f.kind === "dateRange" ? f.fromKey : f.key} filter={f} table={table} />
        ))}
        {/* Page size lives here on phones (the footer is too narrow). */}
        <label className="flex flex-col gap-1.5 sm:hidden">
          <span className="text-xs font-medium text-muted-foreground">{t("rowsPerPage")}</span>
          <NativeSelect value={table.size} onChange={(e) => table.setSize(Number(e.target.value))}>
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </label>
      </PopoverContent>
    </Popover>
  )
}

function FilterField({ filter, table }: { filter: FilterDef; table: TableState }) {
  if (filter.kind === "select") {
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{filter.label}</span>
        <NativeSelect
          value={table.filters[filter.key] || ALL}
          onChange={(e) => table.setFilters({ [filter.key]: e.target.value === ALL ? "" : e.target.value })}
        >
          <option value={ALL}>{filter.allLabel}</option>
          {filter.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </label>
    )
  }
  if (filter.kind === "checkbox") {
    return (
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium md:min-h-9">
        <Checkbox
          checked={table.filters[filter.key] === "1"}
          onCheckedChange={(checked) => table.setFilters({ [filter.key]: checked ? "1" : "" })}
        />
        {filter.label}
      </label>
    )
  }
  return (
    <DateRangeFilter
      label={filter.label}
      from={table.filters[filter.fromKey] ?? ""}
      to={table.filters[filter.toKey] ?? ""}
      onChange={(from, to) => table.setFilters({ [filter.fromKey]: from, [filter.toKey]: to })}
    />
  )
}

type Chip = { id: string; label: string; clear: Record<string, string> }

function FilterChips({ table, filters }: { table: TableState; filters: readonly FilterDef[] }) {
  const t = useTranslations("DataTable")
  const rangeLabel = useRangeLabel()
  const defaults = defaultFilters(table.spec)
  const chips: Chip[] = []
  for (const f of filters) {
    if (f.kind === "select") {
      const value = table.filters[f.key] ?? ""
      if (value === defaults[f.key]) continue
      const option = value === "" ? f.allLabel : (f.options.find((o) => o.value === value)?.label ?? value)
      chips.push({ id: f.key, label: `${f.label}: ${option}`, clear: { [f.key]: defaults[f.key] } })
    } else if (f.kind === "checkbox") {
      if (table.filters[f.key] === "1") chips.push({ id: f.key, label: f.label, clear: { [f.key]: "" } })
    } else {
      const label = rangeLabel(table.filters[f.fromKey] ?? "", table.filters[f.toKey] ?? "")
      if (label) chips.push({ id: f.fromKey, label: `${f.label}: ${label}`, clear: { [f.fromKey]: "", [f.toKey]: "" } })
    }
  }
  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <ul className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto sm:flex-wrap" aria-label={t("activeFilters")}>
        {chips.map((chip) => (
          <li key={chip.id} className="shrink-0">
            <button
              type="button"
              onClick={() => table.setFilters(chip.clear)}
              aria-label={t("removeFilter", { label: chip.label })}
              className="focus-ring inline-flex h-11 items-center gap-1.5 rounded-full border bg-card pr-2.5 pl-3 text-xs font-medium hover:bg-muted md:h-8"
            >
              {chip.label}
              <XIcon className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={table.clearFilters}>
        {t("clearAll")}
      </Button>
    </div>
  )
}
