"use client"

import { ImageIcon, SearchIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"

export type PickerProduct = { _id: string; name: string; price: number; coverUrl: string | null; soldOut: boolean }

const SEARCH_FROM = 8

/**
 * A list of the shop's products to tick: one (radio), several or the
 * products to exclude (checkboxes). 44px rows, a search box for long lists.
 */
export function ProductPicker({
  label,
  products,
  selected,
  onChange,
  single = false,
  price,
  invalid,
  describedBy,
}: {
  label: string
  products: readonly PickerProduct[]
  selected: readonly string[]
  onChange: (ids: string[]) => void
  single?: boolean
  /** The formatted price shown on each row. */
  price: (product: PickerProduct) => string
  invalid?: boolean
  describedBy?: string
}) {
  const t = useTranslations("Sales.form")
  const id = useId()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products

  function toggle(productId: string) {
    if (single) return onChange([productId])
    onChange(selected.includes(productId) ? selected.filter((x) => x !== productId) : [...selected, productId])
  }

  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={invalid} aria-describedby={describedBy}>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      {products.length >= SEARCH_FROM ? (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchProducts")}
            aria-label={t("searchProducts")}
            className="pl-9"
          />
        </div>
      ) : null}
      <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-lg border">
        {shown.length === 0 ? <li className="p-3 text-sm text-muted-foreground">{t("noProductMatch")}</li> : null}
        {shown.map((p) => {
          const checked = selected.includes(p._id)
          return (
            <li key={p._id}>
              <label htmlFor={`${id}-${p._id}`} className={cn("flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted", checked && "bg-muted")}>
                <input
                  id={`${id}-${p._id}`}
                  type={single ? "radio" : "checkbox"}
                  name={single ? id : undefined}
                  checked={checked}
                  onChange={() => toggle(p._id)}
                  className="size-4 shrink-0 accent-[var(--ink)]"
                />
                <span className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
                    <img src={p.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <ImageIcon className="m-auto mt-2.5 size-5 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {price(p)}
                    {p.soldOut ? ` · ${t("soldOut")}` : ""}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {!single ? <p className="text-xs text-muted-foreground">{t("selectedCount", { count: selected.length })}</p> : null}
    </fieldset>
  )
}
