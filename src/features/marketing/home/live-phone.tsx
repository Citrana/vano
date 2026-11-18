import { getLocale, getTranslations } from "next-intl/server"
import { DEMO_CURRENCY, DEMO_PRODUCTS, DEMO_SLUG } from "@/features/marketing/demo/demo-shop"
import { ProductGrid } from "@/features/public/product-grid"
import { ShopHeader } from "@/features/public/shop-header"
import { PhoneThemeScreen } from "./phone-theme"

/**
 * A CSS phone frame showing the real demo shop (same components and
 * themes as /demo), drawn at 375px and zoomed to fit the screen. The
 * content is inert: one label describes it.
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
    <figure
      role="img"
      aria-label={t("mockupLabel")}
      className="relative w-[240px] rounded-[2.5rem] bg-ink p-2 text-left shadow-float sm:w-[260px] md:w-[280px] lg:w-[300px]"
    >
      <div className="relative aspect-[9/19] overflow-hidden rounded-[2rem]">
        <PhoneThemeScreen>
          <div
            inert
            aria-hidden
            className="w-[375px] [zoom:0.597] sm:[zoom:0.651] md:[zoom:0.704] lg:[zoom:0.757]"
          >
            <div className="flex flex-col gap-5 px-4 pt-12 pb-6">
              <ShopHeader shop={shop} />
              <ProductGrid slug={DEMO_SLUG} currency={DEMO_CURRENCY} products={products} columns="phone" />
            </div>
          </div>
        </PhoneThemeScreen>
      </div>
    </figure>
  )
}
