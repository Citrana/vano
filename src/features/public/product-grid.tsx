"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { cn } from "cn"
import { CATEGORY_KEYS, type Category } from "../../../convex/lib/catalog"
import type { Currency } from "../../../convex/lib/money"
import { EmptyState } from "@/components/states/states"
import { ProductCard } from "./product-card"

type Item = {
  _id: string
  name: string
  price: number
  category: Category
  soldOut: boolean
  coverUrl: string | null
}

/** Category filter chips (only categories that have products) + grid. */
export function ProductGrid({
  slug,
  currency,
  products,
  columns = "responsive",
}: {
  slug: string
  currency: Currency
  products: Item[]
  /** "phone": always 2 columns (e.g. inside a phone mockup, whatever the viewport). */
  columns?: "responsive" | "phone"
}) {
  const t = useTranslations("Public")
  const tc = useTranslations("Categories")
  const [active, setActive] = useState<Category | "all">("all")
  const categories = useMemo(
    () => CATEGORY_KEYS.filter((key) => products.some((p) => p.category === key)),
    [products],
  )
  const visible = active === "all" ? products : products.filter((p) => p.category === active)

  if (products.length === 0) return <EmptyState title={t("empty")} />

  return (
    <div className="flex flex-col gap-4">
      {categories.length > 1 ? (
        <div
          role="toolbar"
          aria-label={t("filter")}
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1"
        >
          {(["all", ...categories] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={active === key}
              onClick={() => setActive(key)}
              className={cn(
                "shop-chip min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                active === key ? "chip-selected" : "bg-card hover:bg-muted"
              )}
            >
              {key === "all" ? t("all") : tc(key)}
            </button>
          ))}
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t("emptyCategory")}</p>
      ) : (
        <ul className={cn("grid grid-cols-2 gap-x-3 gap-y-6", columns === "responsive" && "sm:grid-cols-3 lg:grid-cols-4")}>
          {visible.map((p) => (
            <li key={p._id}>
              <ProductCard
                href={`/${slug}/${p._id}`}
                name={p.name}
                price={p.price}
                currency={currency}
                soldOut={p.soldOut}
                coverUrl={p.coverUrl}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
