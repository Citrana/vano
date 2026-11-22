"use client"

import { useLocale, useTranslations } from "next-intl"
import { useId, useState } from "react"
import { cn } from "cn"
import { colorSwatch } from "../../../../convex/lib/colorSwatches"
import { formatMoney, minorToInput, parseMoneyToMinor, type Currency } from "../../../../convex/lib/money"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { searchKey, type FilterOptions, type ShopFilters } from "./shop-filters"

const sameText = (a: string, b: string) => searchKey(a) === searchKey(b)

/** Adds or removes `value` (case and accents ignored). */
function toggle(list: readonly string[], value: string): string[] {
  return list.some((v) => sameText(v, value)) ? list.filter((v) => !sameText(v, value)) : [...list, value]
}

/**
 * Size, colour and price range: the "Filters" panel's content (popover on
 * computers, bottom sheet on phones). Prices are typed in major units
 * and read with `parseMoneyToMinor` (CLAUDE.md "Money").
 */
export function FilterPanel({
  filters,
  options,
  currency,
  onChange,
}: {
  filters: ShopFilters
  options: FilterOptions
  currency: Currency
  onChange: (patch: Partial<ShopFilters>) => void
}) {
  const t = useTranslations("Public.filters")
  const locale = useLocale()
  const id = useId()
  const [min, setMin] = useState(filters.min === null ? "" : minorToInput(filters.min))
  const [max, setMax] = useState(filters.max === null ? "" : minorToInput(filters.max))
  const minValue = min.trim() === "" ? null : parseMoneyToMinor(min)
  const maxValue = max.trim() === "" ? null : parseMoneyToMinor(max)
  const minInvalid = min.trim() !== "" && minValue === null
  const maxInvalid = max.trim() !== "" && (maxValue === null || (minValue !== null && maxValue < minValue))

  // "Clear all" elsewhere: show the cleared prices (React's "adjust state while rendering").
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

  const anySet = filters.sizes.length > 0 || filters.colors.length > 0 || filters.min !== null || filters.max !== null

  return (
    <div className="flex flex-col gap-5">
      {options.sizes.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("size")}</legend>
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
        </fieldset>
      ) : null}

      {options.colors.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("color")}</legend>
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
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("price")}</legend>
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
      </fieldset>

      {anySet ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 w-fit rounded-sm md:min-h-9"
          onClick={() => {
            setMin("")
            setMax("")
            onChange({ sizes: [], colors: [], min: null, max: null })
          }}
        >
          {t("clearPanel")}
        </Button>
      ) : null}
    </div>
  )
}
