"use client"

import type { Category } from "../../../convex/lib/catalog"
import type { Currency } from "../../../convex/lib/money"
import type { ProductLayout } from "../../../convex/lib/looks/sections"
import type { PublicSale } from "../../../convex/lib/sales/active"
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
  /** Every colour and size (`public.shopBySlug`): the filters use them, the card shows a few. */
  colors?: string[]
  sizes?: string[]
  /** Added in the last NEW_BADGE_DAYS (computed by the page). */
  isNew?: boolean
}

/**
 * A list of product cards in the shop's layout: every section and the
 * filtered results draw with it (filters: `ShopFilterBar`).
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
            sizes={p.sizes ?? []}
            isNew={p.isNew ?? false}
            highlight={highlight}
            size={classes.size}
          />
        </li>
      ))}
    </ul>
  )
}
