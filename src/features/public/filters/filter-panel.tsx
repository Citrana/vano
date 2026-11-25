"use client"

import { SearchIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useId, useState, type ReactNode } from "react"
import { cn } from "cn"
import { colorSwatch } from "../../../../convex/lib/colorSwatches"
import type { FilterAccess } from "../../../../convex/lib/looks/filters"
import { NEW_BADGE_DAYS } from "../../../../convex/lib/looks/sections"
import { formatMoney, minorToInput, parseMoneyToMinor, type Currency } from "../../../../convex/lib/money"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Switch } from "@/components/ui/switch"
import { FilterChip } from "./filter-chip"
import { SEARCH_MAX, sameRange, sameText, type FilterOptions, type PriceRange, type ShopFilters } from "./shop-filters"

/** Adds or removes `value` (case and accents ignored). */
function toggle(list: readonly string[], value: string): string[] {
  return list.some((v) => sameText(v, value)) ? list.filter((v) => !sameText(v, value)) : [...list, value]
}

type FiltersT = ReturnType<typeof useTranslations<"Public.filters">>

/** "Up to $20", "$20 – $50", "From $50" (both ends included). */
export function priceRangeLabel(t: FiltersT, range: PriceRange, currency: Currency, locale: string): string {
  const fmt = (minor: number) => formatMoney(minor, currency, locale)
  if (range.min !== null && range.max !== null) return t("priceBetween", { min: fmt(range.min), max: fmt(range.max) })
  if (range.max !== null) return t("priceUpTo", { max: fmt(range.max) })
  if (range.min !== null) return t("priceFrom", { min: fmt(range.min) })
  return ""
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      {children}
    </fieldset>
  )
}

/**
 * The "Filters" panel's content (side sheet on computers, bottom sheet on
 * phones): search, price (quick ranges from the shop's real prices, then
 * min / max), category, size, colour and the On sale / New switches. Only
 * values the shop's products have are shown. Prices are typed in major
 * units and read with `parseMoneyToMinor` (CLAUDE.md "Money").
 */
export function FilterPanel({
  filters,
  options,
  access,
  currency,
  onChange,
}: {
  filters: ShopFilters
  options: FilterOptions
  access: FilterAccess
  currency: Currency
  onChange: (patch: Partial<ShopFilters>) => void
}) {
  const t = useTranslations("Public.filters")
  const tc = useTranslations("Categories")
  const locale = useLocale()
  const id = useId()
  const [min, setMin] = useState(filters.min === null ? "" : minorToInput(filters.min))
  const [max, setMax] = useState(filters.max === null ? "" : minorToInput(filters.max))
  const minValue = min.trim() === "" ? null : parseMoneyToMinor(min)
  const maxValue = max.trim() === "" ? null : parseMoneyToMinor(max)
  const minInvalid = min.trim() !== "" && minValue === null
  const maxInvalid = max.trim() !== "" && (maxValue === null || (minValue !== null && maxValue < minValue))

  // A quick range, a removed chip or "Clear all": show the new prices (React's "adjust state while rendering").
  const [seen, setSeen] = useState({ min: filters.min, max: filters.max })
  if (seen.min !== filters.min || seen.max !== filters.max) {
    setSeen({ min: filters.min, max: filters.max })
    if (filters.min !== minValue) setMin(filters.min === null ? "" : minorToInput(filters.min))
    if (filters.max !== maxValue) setMax(filters.max === null ? "" : minorToInput(filters.max))
  }

  function priceChange(nextMin: string, nextMax: string) {
    setMin(nextMin)
    setMax(nextMax)
    const lo = nextMin.trim() === "" ? null : parseMoneyToMinor(nextMin)
    const hi = nextMax.trim() === "" ? null : parseMoneyToMinor(nextMax)
    const loValid = nextMin.trim() === "" || lo !== null
    const hiValid = nextMax.trim() === "" || (hi !== null && (lo === null || hi >= lo))
    if (loValid && hiValid) onChange({ min: lo, max: hi })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
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

      <Group legend={t("price")}>
        {options.priceRanges.length > 0 ? (
          <div className="flex flex-wrap gap-x-1.5" role="group" aria-label={t("quickPrice")}>
            {options.priceRanges.map((range) => {
              const selected = sameRange(range, filters)
              return (
                <FilterChip
                  key={`${range.min}-${range.max}`}
                  selected={selected}
                  onClick={() => onChange(selected ? { min: null, max: null } : { min: range.min, max: range.max })}
                >
                  {priceRangeLabel(t, range, currency, locale)}
                </FilterChip>
              )
            })}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-min`} className="text-xs text-muted-foreground">
              {t("min")}
            </label>
            <MoneyInput
              id={`${id}-min`}
              currency={currency}
              value={min}
              placeholder={minorToInput(options.minPrice)}
              aria-invalid={minInvalid || undefined}
              onChange={(e) => priceChange(e.target.value, max)}
              className="rounded-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-max`} className="text-xs text-muted-foreground">
              {t("max")}
            </label>
            <MoneyInput
              id={`${id}-max`}
              currency={currency}
              value={max}
              placeholder={minorToInput(options.maxPrice)}
              aria-invalid={maxInvalid || undefined}
              onChange={(e) => priceChange(min, e.target.value)}
              className="rounded-sm"
            />
          </div>
        </div>
        <p className={cn("text-xs", minInvalid || maxInvalid ? "text-destructive" : "text-muted-foreground")}>
          {minInvalid || maxInvalid
            ? t("priceInvalid")
            : t("priceRange", {
                min: formatMoney(options.minPrice, currency, locale),
                max: formatMoney(options.maxPrice, currency, locale),
              })}
        </p>
      </Group>

      {access.categories && options.categories.length > 1 ? (
        <Group legend={t("category")}>
          <div className="flex flex-wrap gap-x-1.5">
            {options.categories.map((key) => (
              <FilterChip key={key} selected={filters.category === key} onClick={() => onChange({ category: filters.category === key ? null : key })}>
                {tc(key)}
              </FilterChip>
            ))}
          </div>
        </Group>
      ) : null}

      {options.sizes.length > 0 ? (
        <Group legend={t("size")}>
          <div className="flex flex-wrap gap-1.5">
            {options.sizes.map((size) => {
              const selected = filters.sizes.some((s) => sameText(s, size))
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ sizes: toggle(filters.sizes, size) })}
                  className="group flex min-h-11 items-center rounded-sm focus-ring"
                >
                  <span
                    className={cn(
                      "flex h-8 min-w-10 items-center justify-center rounded-[2px] border px-2.5 text-xs font-medium transition-colors",
                      selected ? "chip-selected" : "bg-card group-hover:bg-muted",
                    )}
                  >
                    {size}
                  </span>
                </button>
              )
            })}
          </div>
        </Group>
      ) : null}

      {options.colors.length > 0 ? (
        <Group legend={t("color")}>
          <div className="flex flex-wrap gap-1.5">
            {options.colors.map((color) => {
              const selected = filters.colors.some((c) => sameText(c, color))
              const swatch = colorSwatch(color)
              return (
                <button
                  key={color}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ colors: toggle(filters.colors, color) })}
                  className="group flex min-h-11 items-center rounded-sm focus-ring"
                >
                  <span
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                      selected ? "chip-selected" : "bg-card group-hover:bg-muted",
                    )}
                  >
                    {swatch ? (
                      // The seller's colour, drawn as data (not a theme colour).
                      <span className="size-3.5 rounded-full ring-1 ring-foreground/20" style={{ backgroundColor: swatch }} aria-hidden />
                    ) : null}
                    {color}
                  </span>
                </button>
              )
            })}
          </div>
        </Group>
      ) : null}

      {(access.sale && options.sale) || options.hasNew ? (
        <div className="flex flex-col divide-y rounded-sm border">
          {access.sale && options.sale ? (
            <ToggleRow id={`${id}-sale`} label={t("onSale")} checked={filters.sale} onChange={(sale) => onChange({ sale })} />
          ) : null}
          {options.hasNew ? (
            <ToggleRow
              id={`${id}-new`}
              label={t("newOnly")}
              hint={t("newHint", { days: NEW_BADGE_DAYS })}
              checked={filters.isNew}
              onChange={(isNew) => onChange({ isNew })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
      <label htmlFor={id} className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
