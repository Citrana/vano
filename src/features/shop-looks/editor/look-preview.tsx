"use client"

import { MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { Category } from "../../../../convex/lib/catalog"
import type { Currency } from "../../../../convex/lib/money"
import type { ResolvedLook } from "../../../../convex/lib/looks/resolve"
import { buttonVariants } from "@/components/ui/button"
import { ProductGrid } from "@/features/public/product-grid"
import { ShopHeaderView, type HeaderShop } from "@/features/public/shop-header-view"
import { countryName } from "@/features/shop/countries"
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
 */
export function LookPreview({
  look,
  shop,
  currency,
  products,
  sample,
  label,
}: {
  look: ResolvedLook<string>
  shop: HeaderShop
  currency: Currency
  products: PreviewProduct[]
  /** The products are demo samples (the shop has none yet). */
  sample: boolean
  label: string
}) {
  const t = useTranslations("Public")
  const te = useTranslations("LookEditor")
  const locationLabel =
    shop.city && shop.country ? t("location", { city: shop.city, country: countryName(shop.country, shop.language) }) : null

  return (
    <div className="flex flex-col items-center gap-2">
      <PhoneFrame label={label} className="w-[300px]">
        <ShopPreview look={look} zoomClassName="[zoom:0.757]">
          <ShopHeaderView shop={shop} locationLabel={locationLabel} onBanner={look.banner.kind !== "none"} />
          <ProductGrid slug={shop.slug} currency={currency} products={products.slice(0, 4)} columns="phone" />
          <span className={buttonVariants({ size: "lg", variant: "whatsapp", className: "shop-btn w-full" })}>
            <MessageCircleIcon />
            {t("order")}
          </span>
        </ShopPreview>
      </PhoneFrame>
      {sample ? <p className="text-xs text-muted-foreground">{te("preview.sample")}</p> : null}
    </div>
  )
}
