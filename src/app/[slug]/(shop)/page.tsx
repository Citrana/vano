import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { getShopPage } from "@/features/public/data"
import { ProductGrid } from "@/features/public/product-grid"
import { PublicFooter } from "@/features/public/public-footer"
import { ShopHeader } from "@/features/public/shop-header"
import { ShopBanner } from "@/features/shop-looks/shop-banner"
import { ShopLookScope } from "@/features/shop-looks/look-scope"
import { ShopLocaleProvider } from "@/features/public/shop-locale-provider"
import { ShopUnavailable } from "@/features/public/shop-unavailable"
import { ViewTracker } from "@/features/public/view-tracker"

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const page = await getShopPage(slug)
  // Suspended: the layout's metadata applies (noindex).
  if (!page || page.suspended) return {}
  const { shop, products } = page
  const t = await getTranslations({ locale: shop.language, namespace: "Public" })
  const description = shop.description ?? t("metaShopDescription", { shop: shop.name })
  const image = shop.logoUrl ?? products.find((p) => p.coverUrl)?.coverUrl ?? undefined
  return {
    title: { absolute: shop.name },
    description,
    alternates: { canonical: `/${shop.slug}` },
    openGraph: {
      type: "website",
      title: shop.name,
      description,
      url: `/${shop.slug}`,
      locale: shop.language === "fr" ? "fr_FR" : "en_US",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: shop.name, description, images: image ? [image] : undefined },
  }
}

export default async function ShopPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params
  const page = await getShopPage(slug)
  if (!page) notFound()
  // Layouts and pages render in parallel, so this page handles it too.
  if (page.suspended) return <ShopUnavailable name={page.name} language={page.language} />
  const { shop, products } = page
  const hasBanner = shop.look.banner.kind !== "none"

  return (
    <ShopLocaleProvider language={shop.language}>
      <ShopLookScope look={shop.look} className="flex flex-1 flex-col">
        <main className={`mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-10 ${hasBanner ? "md:pt-6" : "pt-6 md:pt-10"}`}>
          {hasBanner ? (
            <ShopBanner banner={shop.look.banner} className="-mx-4 md:mx-0 md:rounded-xl" />
          ) : null}
          <ShopHeader shop={shop} onBanner={hasBanner} />
          <ProductGrid slug={shop.slug} currency={shop.currency} products={products} />
        </main>
        <PublicFooter language={shop.language} />
      </ShopLookScope>
      <ViewTracker shopId={shop._id} />
    </ShopLocaleProvider>
  )
}
