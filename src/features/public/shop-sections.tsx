"use client"

import { SearchXIcon, TagIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import type { Currency } from "../../../convex/lib/money"
import { buildShopSections, type BuiltSection, type SectionsFacet } from "../../../convex/lib/looks/sections"
import { EmptyState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { ShopFilterBar } from "./filters/shop-filter-bar"
import { applyShopFilters, filterOptions, filtersActive, NO_FILTERS, type ShopFilters } from "./filters/shop-filters"
import { useShopFilters } from "./filters/use-shop-filters"
import { ProductList, type GridItem } from "./product-grid"
import { ShopOrderProvider, type ShopOrder } from "./order-context"
import type { GridColumns } from "./product-layout"
import { SaleCountdown } from "./sale"

/**
 * The shop's products as the seller arranged them (CLAUDE.md "Shop
 * looks"): their sections in order (`buildShopSections`: off or empty
 * sections never show, the Sale section only while a sale runs), each in
 * the chosen layout. With `filters` (shop pages, the demo) the filter bar
 * sits on top; while a search, filter or sort is active one results grid
 * replaces the sections. The public page, the look previews and the demo
 * shop draw the same component.
 */
export function ShopSections({
  sections,
  products,
  slug,
  currency,
  columns = "responsive",
  filters: initialFilters,
  syncUrl = false,
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
  /** The filters from the page link; missing = no filter bar (previews). */
  filters?: ShopFilters
  /** Write filter changes back to the page link (the public page). */
  syncUrl?: boolean
  /** The running sale's end, when it shows a countdown (the Sale section's heading). */
  saleEndsAt?: number | null
  /** Previews: at most this many products per section. */
  maxPerSection?: number
  /** The cards' WhatsApp order details; missing = cards without actions. */
  order?: ShopOrder
}) {
  const t = useTranslations("Public")
  const tf = useTranslations("Public.filters")
  const { filters, update } = useShopFilters(initialFilters ?? NO_FILTERS, { syncUrl })
  const options = useMemo(() => filterOptions(products), [products])
  const built = buildShopSections(sections, products)
  if (built.length === 0) return <EmptyState title={t("empty")} />
  // A lone "All products" list needs no heading (today's page).
  const headings = built.length > 1 || built[0].id !== "all"
  const showBar = initialFilters !== undefined && products.length > 1
  const filtering = showBar && filtersActive(filters, options)
  const results = filtering ? applyShopFilters(products, filters, options) : products

  const list = filtering ? (
    results.length > 0 ? (
      <ProductList slug={slug} currency={currency} products={results} layout={sections.layout} columns={columns} />
    ) : (
      <EmptyState
        icon={<SearchXIcon />}
        title={tf("emptyTitle")}
        body={tf("emptyBody")}
        action={
          <Button type="button" variant="outline" className="min-h-11 rounded-sm" onClick={() => update(NO_FILTERS)}>
            {tf("clearAll")}
          </Button>
        }
      />
    )
  ) : (
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
          saleEndsAt={saleEndsAt}
        />
      ))}
    </div>
  )
  const content = showBar ? (
    <div className="flex flex-col gap-4">
      <ShopFilterBar filters={filters} options={options} currency={currency} resultCount={results.length} onChange={update} />
      {list}
    </div>
  ) : (
    list
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
  saleEndsAt,
}: {
  section: BuiltSection<GridItem>
  heading: boolean
  layout: SectionsFacet["layout"]
  slug: string
  currency: Currency
  columns: GridColumns
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
      <ProductList
        slug={slug}
        currency={currency}
        products={section.products}
        layout={layout}
        columns={columns}
        highlight={section.id === "backInStock" ? t("backInStock") : null}
      />
    </section>
  )
}

