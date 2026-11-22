import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"
import { showsSection } from "../../../../convex/lib/looks/sections"
import { AnnouncementBar } from "@/features/public/announcement-bar"
import { getShopPage, withNewBadges } from "@/features/public/data"
import { SaleStrip } from "@/features/public/sale-strip"
import { ShopHeader } from "@/features/public/shop-header"
import { ShopInfo } from "@/features/public/shop-info"
import { ShopSections } from "@/features/public/shop-sections"
import { SHOP_BANNER_EDGE, ShopBanner } from "@/features/shop-looks/shop-banner"
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

export default async function ShopPage({ params, searchParams }: PageProps<"/[slug]">) {
  const { slug } = await params
  const { sale: saleParam } = await searchParams
  const page = await getShopPage(slug)
  if (!page) notFound()
  // Layouts and pages render in parallel, so this page handles it too.
  if (page.suspended) return <ShopUnavailable name={page.name} language={page.language} />
  const { shop } = page
  const products = withNewBadges(page.products)
  const hasBanner = shop.look.banner.kind !== "none"
  const t = await getTranslations({ locale: shop.language, namespace: "Public" })
  // CLAUDE.md "Sales": the "Sale" filter, the countdown strip and the
  // event banner's link only exist while a sale is running.
  const onSale = products.filter((p) => p.sale)
  const banner = hasBanner ? <ShopBanner banner={shop.look.banner} className={SHOP_BANNER_EDGE.responsive} /> : null
  const bannerLinksToSale = shop.look.banner.kind === "event" && shop.look.banner.link === "sale" && onSale.length > 0
  const countdownEnd = onSale.reduce<number | null>(
    (soonest, p) => (p.sale?.countdown && (soonest === null || p.sale.endsAt < soonest) ? p.sale.endsAt : soonest),
    null,
  )
  // CLAUDE.md "Shop looks": the seller's sections; a Sale section carries the countdown itself.
  const { sections, announcement } = shop.look
  const saleSection = showsSection(sections, products, "sale")
  const info = {
    openingHours: shop.openingHours,
    deliveryAreas: shop.deliveryAreas,
    socials: shop.socials,
  }

  return (
    <ShopLocaleProvider language={shop.language}>
      <ShopLookScope look={shop.look} className="flex flex-1 flex-col">
        {announcement ? <AnnouncementBar announcement={announcement} slug={shop.slug} saleLive={onSale.length > 0} /> : null}
        <main className={`mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-10 ${hasBanner ? "md:pt-6" : "pt-6 md:pt-10"}`}>
          <div className="flex flex-col">
            {bannerLinksToSale ? (
              <Link href={`/${shop.slug}?sale=1#products`} aria-label={t("seeSaleItems")} className="block rounded-xl focus-ring">
                {banner}
              </Link>
            ) : (
              banner
            )}
            <ShopHeader shop={shop} profile={shop.look.profile} onBanner={hasBanner} />
          </div>
          {countdownEnd !== null && !saleSection ? <SaleStrip endsAt={countdownEnd} /> : null}
          <div id="products" className="scroll-mt-4">
            <ShopSections
              key={saleParam === "1" ? "sale" : "all"}
              sections={sections}
              slug={shop.slug}
              currency={shop.currency}
              products={products}
              initialFilter={saleParam === "1" && onSale.length > 0 ? "sale" : "all"}
              saleEndsAt={countdownEnd}
              order={{ slug: shop.slug, currency: shop.currency, label: shop.look.buttons.label, whatsappNumber: shop.whatsappNumber }}
            />
          </div>
          {sections.about ? <ShopInfo info={info} shopName={shop.name} /> : null}
        </main>
      </ShopLookScope>
      <ViewTracker shopId={shop._id} />
    </ShopLocaleProvider>
  )
}
