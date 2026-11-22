"use client"

import { useTranslations } from "next-intl"
import type { Currency } from "../../../../convex/lib/money"
import type { ResolvedLook } from "../../../../convex/lib/looks/resolve"
import { ShopHeaderView } from "@/features/public/shop-header-view"
import { countryName } from "@/features/shop/countries"
import { profileLabelsFrom } from "../profile/labels"
import { ShopLookScope } from "../look-scope"
import { SHOP_BANNER_EDGE, ShopBanner } from "../shop-banner"
import { PreviewAnnouncement, PreviewBody, type PreviewProduct, type PreviewShop } from "./preview-body"

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
  shop: PreviewShop
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
          {/* The public page's desktop layout: banner, header and grid share the column's left edge. */}
          <div inert aria-hidden className="w-[1280px] [zoom:0.25]">
            <PreviewAnnouncement look={look} shop={shop} />
            <div className={`mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-10 ${hasBanner ? "pt-6" : "pt-10"}`}>
              <div className="flex flex-col">
                {hasBanner ? (
                  <ShopBanner banner={look.banner} sizing="desktop" priority={false} className={SHOP_BANNER_EDGE.desktop} />
                ) : null}
                <ShopHeaderView
                  shop={shop}
                  locationLabel={locationLabel}
                  labels={profileLabelsFrom(t)}
                  profile={look.profile}
                  onBanner={hasBanner}
                  sizing="desktop"
                />
              </div>
              <PreviewBody
                look={look}
                shop={shop}
                currency={currency}
                products={products}
                columns="responsive"
              />
            </div>
          </div>
        </ShopLookScope>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  )
}
