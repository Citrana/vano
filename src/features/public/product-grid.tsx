"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { cn } from "cn"
import { CATEGORY_KEYS, type Category } from "../../../convex/lib/catalog"
import type { Currency } from "../../../convex/lib/money"
import type { ProductLayout } from "../../../convex/lib/looks/sections"
import type { PublicSale } from "../../../convex/lib/sales/active"
import { EmptyState } from "@/components/states/states"
import { ProductCard } from "./product-card"
import { productListClasses, type GridColumns } from "./product-layout"

export type GridItem = {
  _id: string
  name: string
  price: number
  category: Category
  soldOut: boolean
  coverUrl: string | null
  sale?: PublicSale | null
  featured?: boolean
  fewLeft?: boolean
  backInStock?: boolean
  /** Up to 4 colours and sizes for the card (`public.shopBySlug`). */
  colors?: string[]
  moreColors?: number
  sizes?: string[]
  moreSizes?: number
  /** Added in the last NEW_BADGE_DAYS (computed by the page). */
  isNew?: boolean
}

export type GridFilter = Category | "all" | "sale"

/**
 * A list of product cards in the shop's layout (no filters): the
 * sections and the "All products" grid both draw with it.
 */
export function ProductList({
  slug,
  currency,
  products,
  layout = "grid2",
  columns = "responsive",
  highlight = null,
}: {
  slug: string
  currency: Currency
  products: GridItem[]
  layout?: ProductLayout
  columns?: GridColumns
  /** A label every card shows (e.g. "Back in stock" in that section). */
  highlight?: string | null
}) {
  const classes = productListClasses(layout, columns)
  return (
    <ul className={classes.list}>
      {products.map((p) => (
        <li key={p._id}>
          <ProductCard
            productId={p._id}
            href={`/${slug}/${p._id}`}
            name={p.name}
            price={p.price}
            currency={currency}
            soldOut={p.soldOut}
            coverUrl={p.coverUrl}
            sale={p.sale}
            fewLeft={p.fewLeft}
            colors={p.colors ?? []}
            moreColors={p.moreColors ?? 0}
            sizes={p.sizes ?? []}
            moreSizes={p.moreSizes ?? 0}
            isNew={p.isNew ?? false}
            highlight={highlight}
            size={classes.size}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * Filter chips + grid: a "Sale" chip while at least one product is on
 * sale (CLAUDE.md "Sales"), then the categories that have products.
 */
export function ProductGrid({
  slug,
  currency,
  products,
  columns = "responsive",
  layout = "grid2",
  initialFilter = "all",
}: {
  slug: string
  currency: Currency
  products: GridItem[]
  /** "phone": always the phone layout (e.g. inside a phone mockup, whatever the viewport). */
  columns?: GridColumns
  /** The seller's product layout (CLAUDE.md "Shop looks"). */
  layout?: ProductLayout
  /** E.g. "sale" from `?sale=1` (the event banner's link). */
  initialFilter?: GridFilter
}) {
  const t = useTranslations("Public")
  const tc = useTranslations("Categories")
  const hasSale = products.some((p) => p.sale)
  const [chosen, setActive] = useState<GridFilter>(initialFilter)
  // The sale may end while the page is open: fall back to everything.
  const active: GridFilter = chosen === "sale" && !hasSale ? "all" : chosen
  const categories = useMemo(
    () => CATEGORY_KEYS.filter((key) => products.some((p) => p.category === key)),
    [products],
  )
  const visible =
    active === "all" ? products : active === "sale" ? products.filter((p) => p.sale) : products.filter((p) => p.category === active)
  const filters: GridFilter[] = ["all", ...(hasSale ? (["sale"] as const) : []), ...categories]

  if (products.length === 0) return <EmptyState title={t("empty")} />

  return (
    <div className="flex flex-col gap-4">
      {filters.length > 2 ? (
        <div
          role="toolbar"
          aria-label={t("filter")}
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1"
        >
          {filters.map((key) => (
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
              {key === "all" ? t("all") : key === "sale" ? t("saleFilter") : tc(key)}
            </button>
          ))}
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t("emptyCategory")}</p>
      ) : (
        <ProductList slug={slug} currency={currency} products={visible} layout={layout} columns={columns} />
      )}
    </div>
  )
}
