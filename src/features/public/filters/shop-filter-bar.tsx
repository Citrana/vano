"use client"

import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useRef, useState, type ReactNode, type RefObject } from "react"
import { cn } from "cn"
import type { Currency } from "../../../../convex/lib/money"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerHandle, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { FilterPanel } from "./filter-panel"
import { filtersActive, NO_FILTERS, panelFilterCount, SEARCH_MAX, SHOP_SORTS, type FilterOptions, type ShopFilters, type ShopSort } from "./shop-filters"

/**
 * A small filter chip: a 32px pill (the look's chip style) inside a 44px
 * tap target. Selected chips use `chip-selected`.
 */
export function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className="group flex min-h-11 shrink-0 items-center rounded-sm focus-ring">
      <span
        className={cn(
          "shop-chip flex h-8 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
          selected ? "chip-selected" : "bg-card group-hover:bg-muted",
        )}
      >
        {children}
      </span>
    </button>
  )
}

/**
 * The shop's search, chips, sort and the "Filters" panel (CLAUDE.md
 * "Public pages"). Shops with fewer than FULL_FILTERS_MIN_PRODUCTS
 * products only get the Sale chip and the sort. The panel is a popover on
 * computers and a bottom sheet on phones, mounted inside the shop's look
 * scope (`container`) so it uses the shop's colours.
 */
export function ShopFilterBar({
  filters,
  options,
  currency,
  resultCount,
  onChange,
}: {
  filters: ShopFilters
  options: FilterOptions
  currency: Currency
  resultCount: number
  onChange: (patch: Partial<ShopFilters>) => void
}) {
  const t = useTranslations("Public.filters")
  const tp = useTranslations("Public")
  const tc = useTranslations("Categories")
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const { full } = options
  const panelCount = panelFilterCount(filters)
  const showChips = (full && options.categories.length > 1) || options.sale
  const filtering = filtersActive(filters, options)

  const panel = <FilterPanel filters={filters} options={options} currency={currency} onChange={onChange} />
  const panelLabel = panelCount > 0 ? t("filtersCount", { count: panelCount }) : t("filters")
  const triggerClass = "min-h-11 shrink-0 gap-1.5 rounded-sm px-3 text-sm md:min-h-9"

  return (
    <div ref={root} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {full ? (
          <div className="relative min-w-0 flex-1">
            <label htmlFor={`${id}-q`} className="sr-only">
              {t("search")}
            </label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id={`${id}-q`}
              type="search"
              enterKeyHint="search"
              value={filters.q}
              maxLength={SEARCH_MAX}
              placeholder={t("search")}
              onChange={(e) => onChange({ q: e.target.value })}
              className="rounded-sm ps-9"
            />
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
          className="w-auto shrink-0 rounded-sm"
        >
          {SHOP_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`sorts.${sort}`)}
            </option>
          ))}
        </NativeSelect>
        {full ? (
          <>
            {/* Computers: a popover. */}
            <Popover>
              <PopoverTrigger render={<Button type="button" variant="outline" className={cn(triggerClass, "hidden lg:inline-flex")} />}>
                <SlidersHorizontalIcon className="size-4" aria-hidden />
                {panelLabel}
              </PopoverTrigger>
              <PopoverContent container={root} className="w-96">
                <PopoverTitle>{t("filters")}</PopoverTitle>
                {panel}
              </PopoverContent>
            </Popover>
            {/* Phones and tablets: a bottom sheet. */}
            <PhoneFilterSheet triggerClass={cn(triggerClass, "lg:hidden")} label={panelLabel} container={root} resultCount={resultCount}>
              {panel}
            </PhoneFilterSheet>
          </>
        ) : null}
      </div>

      {showChips ? (
        <div role="toolbar" aria-label={tp("filter")} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {full && options.categories.length > 1 ? (
            <FilterChip selected={filters.category === null && !filters.sale} onClick={() => onChange({ category: null, sale: false })}>
              {tp("all")}
            </FilterChip>
          ) : null}
          {options.sale ? (
            <FilterChip selected={filters.sale} onClick={() => onChange({ sale: !filters.sale })}>
              {tp("saleFilter")}
            </FilterChip>
          ) : null}
          {full && options.categories.length > 1
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
      ) : null}

      {filtering ? (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("results", { count: resultCount })}
          </p>
          <Button type="button" variant="ghost" size="sm" className="min-h-11 rounded-sm md:min-h-9" onClick={() => onChange(NO_FILTERS)}>
            <XIcon className="size-4" aria-hidden />
            {t("clearAll")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PhoneFilterSheet({
  triggerClass,
  label,
  container,
  resultCount,
  children,
}: {
  triggerClass: string
  label: string
  container: RefObject<HTMLDivElement | null>
  resultCount: number
  children: ReactNode
}) {
  const t = useTranslations("Public.filters")
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" className={triggerClass} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <SlidersHorizontalIcon className="size-4" aria-hidden />
        {label}
      </Button>
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
          <DrawerClose render={<Button type="button" className="shop-btn min-h-11 w-full" />}>
            {t("showResults", { count: resultCount })}
          </DrawerClose>
        </DrawerBody>
      </DrawerContent>
      </Drawer>
    </>
  )
}
