import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { DemoLookBanner, DemoThemeSwitch } from "@/features/marketing/demo/demo-theme"
import { DEMO_CURRENCY, DEMO_PRODUCTS, DEMO_SECTIONS, DEMO_SLUG } from "@/features/marketing/demo/demo-shop"
import { ShopSections } from "@/features/public/shop-sections"
import { ShopHeader } from "@/features/public/shop-header"
import { SHOP_BANNER_EDGE } from "@/features/shop-looks/shop-banner"

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
    featured: p.featured ?? false,
    fewLeft: p.fewLeft ?? false,
    backInStock: p.backInStock ?? false,
    colors: p.colors,
    sizes: p.sizes.slice(0, 4),
    moreSizes: Math.max(0, p.sizes.length - 4),
    isNew: p.isNew ?? false,
  }))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-12 md:pt-6">
      <div className="flex flex-col">
        <DemoLookBanner className={SHOP_BANNER_EDGE.responsive} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <ShopHeader shop={shop} onBanner />
          <DemoThemeSwitch label={t("themeLabel")} />
        </div>
      </div>
      <ShopSections
        sections={DEMO_SECTIONS}
        slug={DEMO_SLUG}
        currency={DEMO_CURRENCY}
        products={products}
        order={{ slug: DEMO_SLUG, currency: DEMO_CURRENCY, label: "order", demo: true }}
      />
    </div>
  )
}
