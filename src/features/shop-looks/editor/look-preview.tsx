"use client"

import { MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { Category } from "../../../../convex/lib/catalog"
import type { Currency } from "../../../../convex/lib/money"
import type { ResolvedLook } from "../../../../convex/lib/looks/resolve"
import { cn } from "cn"
import { buttonVariants } from "@/components/ui/button"
import { ProductGrid } from "@/features/public/product-grid"
import { ShopHeaderView, type HeaderShop } from "@/features/public/shop-header-view"
import { countryName } from "@/features/shop/countries"
import { profileLabelsFrom } from "../profile/labels"
import { PhoneFrame } from "../phone-frame"
import { ShopPreview } from "../shop-preview"

export type PreviewProduct = {
  _id: string
  name: string
  price: number
  category: Category
  soldOut: boolean
  coverUrl: string | null
}

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
  compact = false,
  className,
}: {
  look: ResolvedLook<string>
  shop: HeaderShop
  currency: Currency
  /** 2 to 4 (`previewProducts`). */
  products: PreviewProduct[]
  label: string
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
      <ProductGrid slug={shop.slug} currency={currency} products={products.slice(0, 4)} columns="phone" />
      <span className={buttonVariants({ size: "lg", variant: "whatsapp", className: "shop-btn shop-action w-full" })}>
        <MessageCircleIcon />
        {t(`orderLabels.${look.buttons.label}`)}
      </span>
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
