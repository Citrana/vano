"use client"

import { useTranslations } from "next-intl"
import type { Currency } from "../../../../convex/lib/money"
import type { ResolvedLook } from "../../../../convex/lib/looks/resolve"
import { cn } from "cn"
import { ShopHeaderView } from "@/features/public/shop-header-view"
import { countryName } from "@/features/shop/countries"
import { profileLabelsFrom } from "../profile/labels"
import { PhoneFrame } from "../phone-frame"
import { ShopPreview } from "../shop-preview"
import { PreviewAnnouncement, PreviewBody, type PreviewProduct, type PreviewShop } from "./preview-body"

export type { PreviewProduct } from "./preview-body"

/**
 * The live phone preview: the real public header and grid, drawn in the
 * draft look at phone width. Updates on every edit (no server round trip).
 * `compact`: no phone frame, the top of the page in a short box (the
 * sticky preview above the phone editor's sheet).
 */
export function LookPreview({
  look,
  shop,
  currency,
  products,
  label,
  promoSale = false,
  compact = false,
  className,
}: {
  look: ResolvedLook<string>
  shop: PreviewShop
  currency: Currency
  /** 2 to PREVIEW_SECTIONS_MAX (`previewProducts`). */
  products: PreviewProduct[]
  label: string
  /** Show the Promo bar as during a sale (the editor's "Preview as"). */
  promoSale?: boolean
  compact?: boolean
  className?: string
}) {
  const t = useTranslations("Public")
  const locationLabel =
    shop.city && shop.country ? t("location", { city: shop.city, country: countryName(shop.country, shop.language) }) : null

  const page = (zoom: string) => (
    <ShopPreview look={look} zoomClassName={zoom}>
      <ShopHeaderView
        shop={shop}
        locationLabel={locationLabel}
        labels={profileLabelsFrom(t)}
        profile={look.profile}
        onBanner={look.banner.kind !== "none"}
        sizing="phone"
      />
      <PreviewAnnouncement look={look} shop={shop} sale={promoSale} />
      <PreviewBody look={look} shop={shop} currency={currency} products={products} columns="phone" />
    </ShopPreview>
  )

  if (compact) {
    return (
      <figure role="img" aria-label={label} className={cn("mx-auto w-[328px] max-w-full overflow-hidden rounded-xl border", className)}>
        {page("[zoom:0.8747]")}
      </figure>
    )
  }
  return (
    <PhoneFrame label={label} className={cn("w-[300px]", className)}>
      {page("[zoom:0.757]")}
    </PhoneFrame>
  )
}
