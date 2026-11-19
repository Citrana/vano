import { getLocale, getTranslations } from "next-intl/server"
import { DEMO_CURRENCY, DEMO_PRODUCTS, DEMO_SLUG } from "@/features/marketing/demo/demo-shop"
import { ProductGrid } from "@/features/public/product-grid"
import { ShopHeader } from "@/features/public/shop-header"
import { PhoneFrame } from "@/features/shop-looks/phone-frame"
import { PhoneThemeScreen } from "./phone-theme"

/**
 * A CSS phone frame showing the real demo shop (same components and
 * presets as /demo and sellers' shops), drawn at 375px and zoomed to fit
 * the screen. The content is inert: one label describes it.
 */
export async function LivePhone() {
  const t = await getTranslations("Home")
  const td = await getTranslations("Demo")
  const locale = await getLocale()
  const shop = {
    name: td("shopName"),
    slug: DEMO_SLUG,
    language: locale === "fr" ? ("fr" as const) : ("en" as const),
    logoUrl: null,
    description: td("shopDescription"),
  }
  const products = DEMO_PRODUCTS.slice(0, 4).map((p) => ({
    _id: p.id,
    name: td(`products.${p.id}.name`),
    price: p.price,
    category: p.category,
    soldOut: p.soldOut ?? false,
    coverUrl: p.photos[0].src,
  }))

  return (
    <PhoneFrame label={t("mockupLabel")} className="w-[240px] sm:w-[260px] md:w-[280px] lg:w-[300px]">
      <PhoneThemeScreen zoomClassName="[zoom:0.597] sm:[zoom:0.651] md:[zoom:0.704] lg:[zoom:0.757]">
        <ShopHeader shop={shop} onBanner sizing="phone" />
        <ProductGrid slug={DEMO_SLUG} currency={DEMO_CURRENCY} products={products} columns="phone" />
      </PhoneThemeScreen>
    </PhoneFrame>
  )
}
