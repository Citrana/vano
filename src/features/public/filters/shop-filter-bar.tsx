"use client"

import { SlidersHorizontalIcon, XIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useId, useRef, useState, type ReactNode, type RefObject } from "react"
import type { FilterAccess } from "../../../../convex/lib/looks/filters"
import type { Currency } from "../../../../convex/lib/money"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerHandle, DrawerTitle } from "@/components/ui/drawer"
import { NativeSelect } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useIsDesktop } from "@/lib/use-is-desktop"
import { FilterChip } from "./filter-chip"
import { FilterPanel, priceRangeLabel } from "./filter-panel"
import {
  activeFilterChips,
  isFiltering,
  NO_FILTERS,
  panelFilterCount,
  SHOP_SORTS,
  type ActiveFilterChip,
  type FilterOptions,
  type ShopFilters,
  type ShopSort,
} from "./shop-filters"

/**
 * The shop's filter row (CLAUDE.md "Shop looks"): one slim line with the
 * category chips, the Sale chip, the sort and the "Filters" button (with
 * a count badge), then the active filters as removable chips, the result
 * count and "Clear all". What shows comes from the server's
 * `FilterAccess` (setting, product count, plan); the panel is a side
 * sheet on computers and a bottom sheet on phones, both mounted inside
 * the shop's look scope (`root`) so they use the shop's colours.
 * `filters` are already limited to what the shop offers.
 */
export function ShopFilterBar({
  filters,
  options,
  access,
  currency,
  resultCount,
  onChange,
}: {
  filters: ShopFilters
  options: FilterOptions
  access: FilterAccess
  currency: Currency
  resultCount: number
  onChange: (patch: Partial<ShopFilters>) => void
}) {
  const t = useTranslations("Public.filters")
  const tp = useTranslations("Public")
  const tc = useTranslations("Categories")
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const showCategories = access.categories && options.categories.length > 1
  const showSale = access.sale && options.sale
  const panelCount = panelFilterCount(filters)
  const filtering = isFiltering(filters)
  const chips = activeFilterChips(filters)

  return (
    <div ref={root} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {showCategories || showSale ? (
          <div role="toolbar" aria-label={tp("filter")} className="no-scrollbar -ms-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto ps-4">
            {showCategories ? (
              <FilterChip selected={filters.category === null && !filters.sale} onClick={() => onChange({ category: null, sale: false })}>
                {tp("all")}
              </FilterChip>
            ) : null}
            {showSale ? (
              <FilterChip selected={filters.sale} onClick={() => onChange({ sale: !filters.sale })}>
                {tp("saleFilter")}
              </FilterChip>
            ) : null}
            {showCategories
              ? options.categories.map((key) => (
                  <FilterChip
                    key={key}
                    selected={filters.category === key}
                    onClick={() => onChange({ category: filters.category === key ? null : key })}
                  >
                    {tc(key)}
                  </FilterChip>
                ))
              : null}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <label htmlFor={`${id}-sort`} className="sr-only">
          {t("sort")}
        </label>
        <NativeSelect
          id={`${id}-sort`}
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as ShopSort })}
          className="w-auto max-w-[9.5rem] shrink-0 rounded-sm sm:max-w-none"
        >
          {SHOP_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`sorts.${sort}`)}
            </option>
          ))}
        </NativeSelect>
        {access.panel ? (
          <FilterPanelButton
            count={panelCount}
            container={root}
            resultCount={resultCount}
            onClear={() => onChange({ ...NO_FILTERS, sort: filters.sort })}
            canClear={filtering}
          >
            <FilterPanel filters={filters} options={options} access={access} currency={currency} onChange={onChange} />
          </FilterPanelButton>
        ) : null}
      </div>

      {filtering ? (
        <div className="flex flex-col gap-1">
          {chips.length > 0 ? (
            <ul aria-label={t("activeFilters")} className="flex flex-wrap gap-x-1.5">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <ActiveChip chip={chip} currency={currency} onRemove={() => onChange(chip.patch)} />
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex min-h-11 items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t("results", { count: resultCount })}
            </p>
            <Button type="button" variant="ghost" size="sm" className="min-h-11 rounded-sm md:min-h-9" onClick={() => onChange(NO_FILTERS)}>
              <XIcon className="size-4" aria-hidden />
              {t("clearAll")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** One active filter, removed with a tap. */
function ActiveChip({ chip, currency, onRemove }: { chip: ActiveFilterChip; currency: Currency; onRemove: () => void }) {
  const t = useTranslations("Public.filters")
  const tp = useTranslations("Public")
  const tc = useTranslations("Categories")
  const locale = useLocale()
  const label = (() => {
    switch (chip.kind) {
      case "q":
        return t("chipSearch", { q: chip.value })
      case "category":
        return tc(chip.value)
      case "sale":
        return tp("saleFilter")
      case "isNew":
        return t("newOnly")
      case "size":
        return t("chipSize", { size: chip.value })
      case "color":
        return chip.value
      case "condition":
        return tp(`conditions.${chip.value}`)
      case "audience":
        return tp(`audiences.${chip.value}`)
      case "price":
        return priceRangeLabel(t, chip.range, currency, locale)
    }
  })()
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={t("removeFilter", { label })}
      className="group flex min-h-11 items-center rounded-sm focus-ring"
    >
      <span className="shop-chip flex h-7 max-w-[14rem] items-center gap-1 rounded-full border bg-card ps-2.5 pe-1.5 text-xs font-medium group-hover:bg-muted">
        <span className="truncate">{label}</span>
        <XIcon className="size-3.5 shrink-0" aria-hidden />
      </span>
    </button>
  )
}

/**
 * The "Filters" button (count badge in the look's badge colours) and its
 * panel: a side sheet on computers, a bottom sheet on phones.
 */
function FilterPanelButton({
  count,
  container,
  resultCount,
  canClear,
  onClear,
  children,
}: {
  count: number
  container: RefObject<HTMLDivElement | null>
  resultCount: number
  canClear: boolean
  onClear: () => void
  children: ReactNode
}) {
  const t = useTranslations("Public.filters")
  const [open, setOpen] = useState(false)
  const isDesktop = useIsDesktop()
  const label = count > 0 ? t("filtersCount", { count }) : t("filters")

  const footer = (close: ReactNode) => (
    <div className="flex shrink-0 items-center gap-2 border-t pt-3">
      <Button type="button" variant="ghost" className="min-h-11 rounded-sm" disabled={!canClear} onClick={onClear}>
        {t("clearAll")}
      </Button>
      {close}
    </div>
  )

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 shrink-0 gap-1.5 rounded-sm px-3 text-sm md:min-h-9"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontalIcon className="size-4" aria-hidden />
        <span className="hidden sm:inline" aria-hidden>
          {t("filters")}
        </span>
        {count > 0 ? (
          <span
            aria-hidden
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--chip,var(--foreground))] px-1 text-[11px] leading-none font-bold text-[var(--chip-foreground,var(--background))] tabular-nums"
          >
            {count}
          </span>
        ) : null}
      </Button>

      {isDesktop ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" container={container} className="w-full gap-0 p-0 sm:max-w-sm">
            <div className="border-b px-4 py-3">
              <SheetTitle>{t("filters")}</SheetTitle>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
            <div className="px-4 pb-4">
              {footer(
                <Button type="button" className="shop-btn min-h-11 flex-1" onClick={() => setOpen(false)}>
                  {t("showResults", { count: resultCount })}
                </Button>,
              )}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer modal disablePointerDismissal={false} open={open} onOpenChange={setOpen}>
          <DrawerContent container={container} aria-label={t("filters")}>
            <div className="flex shrink-0 flex-col gap-2 border-b px-4 pt-2 pb-2 select-none">
              <DrawerHandle />
              <div className="flex items-center justify-between gap-2">
                <DrawerTitle>{t("filters")}</DrawerTitle>
                <DrawerClose render={<Button type="button" variant="ghost" size="icon" aria-label={t("close")} title={t("close")} />}>
                  <XIcon />
                </DrawerClose>
              </div>
            </div>
            <DrawerBody className="flex flex-col gap-5">
              {children}
              {footer(
                <DrawerClose render={<Button type="button" className="shop-btn min-h-11 flex-1" />}>
                  {t("showResults", { count: resultCount })}
                </DrawerClose>,
              )}
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
