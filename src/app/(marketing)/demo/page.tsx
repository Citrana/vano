import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { DemoLookBanner, DemoThemeSwitch } from "@/features/marketing/demo/demo-theme"
import { DEMO_CURRENCY, DEMO_PRODUCTS, DEMO_SLUG } from "@/features/marketing/demo/demo-shop"
import { ProductGrid } from "@/features/public/product-grid"
import { ShopHeader } from "@/features/public/shop-header"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Demo")
  const title = t("metaTitle")
  const description = t("metaDescription")
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/demo" },
    openGraph: { type: "website", siteName: "Vano", url: "/demo", title, description },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function DemoShopPage() {
  const t = await getTranslations("Demo")
  const locale = await getLocale()
  const shop = {
    name: t("shopName"),
    slug: DEMO_SLUG,
    language: locale === "fr" ? ("fr" as const) : ("en" as const),
    logoUrl: null,
    description: t("shopDescription"),
  }
  const products = DEMO_PRODUCTS.map((p) => ({
    _id: p.id,
    name: t(`products.${p.id}.name`),
    price: p.price,
    category: p.category,
    soldOut: p.soldOut ?? false,
    coverUrl: p.photos[0].src,
  }))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-12 md:pt-6">
      <div className="flex flex-col">
        <DemoLookBanner className="-mx-4 md:mx-0 md:rounded-xl" />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:px-6">
          <ShopHeader shop={shop} onBanner />
          <DemoThemeSwitch label={t("themeLabel")} />
        </div>
      </div>
      <ProductGrid slug={DEMO_SLUG} currency={DEMO_CURRENCY} products={products} />
    </div>
  )
}
