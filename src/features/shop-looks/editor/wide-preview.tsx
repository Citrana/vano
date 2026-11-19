"use client"

import { useTranslations } from "next-intl"
import type { Currency } from "../../../../convex/lib/money"
import type { ResolvedLook } from "../../../../convex/lib/looks/resolve"
import { ProductGrid } from "@/features/public/product-grid"
import { ShopHeaderView, type HeaderShop } from "@/features/public/shop-header-view"
import { countryName } from "@/features/shop/countries"
import { ShopLookScope } from "../look-scope"
import { ShopBanner } from "../shop-banner"
import type { PreviewProduct } from "./look-preview"

/**
 * The shop on a computer: the page at 1280px, scaled down to the preview
 * column, so the seller can check the banner on a wide screen too. Inert.
 */
export function WidePreview({
  look,
  shop,
  currency,
  products,
  label,
}: {
  look: ResolvedLook<string>
  shop: HeaderShop
  currency: Currency
  products: PreviewProduct[]
  label: string
}) {
  const t = useTranslations("Public")
  const locationLabel =
    shop.city && shop.country ? t("location", { city: shop.city, country: countryName(shop.country, shop.language) }) : null
  const hasBanner = look.banner.kind !== "none"

  return (
    <figure className="flex w-[320px] flex-col gap-2">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div aria-hidden className="flex gap-1 border-b px-2 py-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 rounded-full bg-muted-foreground/40" />
          ))}
        </div>
        <ShopLookScope look={look} className="h-[230px] overflow-hidden">
          <div inert aria-hidden className="w-[1280px] [zoom:0.25]">
            {hasBanner ? <ShopBanner banner={look.banner} sizing="desktop" priority={false} /> : null}
            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-8 pb-10">
              <ShopHeaderView shop={shop} locationLabel={locationLabel} onBanner={hasBanner} />
              <ProductGrid slug={shop.slug} currency={currency} products={products.slice(0, 4)} />
            </div>
          </div>
        </ShopLookScope>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  )
}
