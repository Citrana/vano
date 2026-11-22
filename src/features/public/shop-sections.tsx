"use client"

import { TagIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { Currency } from "../../../convex/lib/money"
import { buildShopSections, type BuiltSection, type SectionsFacet } from "../../../convex/lib/looks/sections"
import { EmptyState } from "@/components/states/states"
import { ProductGrid, ProductList, type GridFilter, type GridItem } from "./product-grid"
import { ShopOrderProvider, type ShopOrder } from "./order-context"
import type { GridColumns } from "./product-layout"
import { SaleCountdown } from "./sale"

/**
 * The shop's products as the seller arranged them (CLAUDE.md "Shop
 * looks"): their sections in order (`buildShopSections`: off or empty
 * sections never show, the Sale section only while a sale runs), each in
 * the chosen layout. "All products" keeps its filter chips. The public
 * page, the look previews and the demo shop draw the same component.
 */
export function ShopSections({
  sections,
  products,
  slug,
  currency,
  columns = "responsive",
  initialFilter = "all",
  saleEndsAt = null,
  maxPerSection,
  order,
}: {
  sections: SectionsFacet
  /** Visible products, newest first. */
  products: GridItem[]
  slug: string
  currency: Currency
  columns?: GridColumns
  initialFilter?: GridFilter
  /** The running sale's end, when it shows a countdown (the Sale section's heading). */
  saleEndsAt?: number | null
  /** Previews: at most this many products per section. */
  maxPerSection?: number
  /** The cards' WhatsApp order details; missing = cards without actions. */
  order?: ShopOrder
}) {
  const t = useTranslations("Public")
  const built = buildShopSections(sections, products)
  if (built.length === 0) return <EmptyState title={t("empty")} />
  // A lone "All products" list needs no heading (today's page).
  const headings = built.length > 1 || built[0].id !== "all"

  const content = (
    <div className="flex flex-col gap-10">
      {built.map((section) => (
        <ShopSection
          key={section.key}
          section={maxPerSection ? { ...section, products: section.products.slice(0, maxPerSection) } : section}
          heading={headings}
          layout={sections.layout}
          slug={slug}
          currency={currency}
          columns={columns}
          initialFilter={initialFilter}
          saleEndsAt={saleEndsAt}
        />
      ))}
    </div>
  )
  return order ? <ShopOrderProvider order={order}>{content}</ShopOrderProvider> : content
}

function ShopSection({
  section,
  heading,
  layout,
  slug,
  currency,
  columns,
  initialFilter,
  saleEndsAt,
}: {
  section: BuiltSection<GridItem>
  heading: boolean
  layout: SectionsFacet["layout"]
  slug: string
  currency: Currency
  columns: GridColumns
  initialFilter: GridFilter
  saleEndsAt: number | null
}) {
  const t = useTranslations("Public")
  const tc = useTranslations("Categories")
  const id = `section-${section.key.replace(":", "-")}`
  const title = section.id === "category" && section.category ? tc(section.category) : t(`sections.${section.id}`)

  return (
    <section aria-labelledby={heading ? id : undefined} className="flex scroll-mt-4 flex-col gap-4">
      {heading ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 id={id} className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight md:text-xl">
            {section.id === "sale" ? <TagIcon className="size-4 text-[var(--shop-price,currentColor)]" aria-hidden /> : null}
            {title}
          </h2>
          {section.id === "sale" && saleEndsAt !== null ? <SaleCountdown endsAt={saleEndsAt} /> : null}
        </div>
      ) : null}
      {section.id === "all" ? (
        <ProductGrid
          slug={slug}
          currency={currency}
          products={section.products}
          layout={layout}
          columns={columns}
          initialFilter={initialFilter}
        />
      ) : (
        <ProductList
          slug={slug}
          currency={currency}
          products={section.products}
          layout={layout}
          columns={columns}
          highlight={section.id === "backInStock" ? t("backInStock") : null}
        />
      )}
    </section>
  )
}

