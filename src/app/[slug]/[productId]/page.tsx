import type { Metadata } from "next"
import { ArrowLeftIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"
import { formatMoney } from "../../../../convex/lib/money"
import { getProductPage } from "@/features/public/data"
import { OrderPanel } from "@/features/public/order-panel"
import { ProductGallery } from "@/features/public/product-gallery"
import { PublicFooter } from "@/features/public/public-footer"
import { ShopHeader } from "@/features/public/shop-header"
import { ShopLookScope } from "@/features/shop-looks/look-scope"
import { ShopLocaleProvider } from "@/features/public/shop-locale-provider"
import { ShopUnavailable } from "@/features/public/shop-unavailable"
import { ViewTracker } from "@/features/public/view-tracker"

export async function generateMetadata({ params }: PageProps<"/[slug]/[productId]">): Promise<Metadata> {
  const { slug, productId } = await params
  const page = await getProductPage(slug, productId)
  // Suspended shop: the [slug] layout's metadata applies (noindex).
  if (!page || page.suspended) return {}
  const { shop, product } = page
  const title = `${product.name} – ${shop.name}`
  // On sale: the sale price and the normal one (CLAUDE.md "Sales").
  const price = product.sale
    ? `${formatMoney(product.sale.price, shop.currency, shop.language)} (${formatMoney(product.sale.original, shop.currency, shop.language)})`
    : formatMoney(product.price, shop.currency, shop.language)
  const description = [price, product.description].filter(Boolean).join(" · ").slice(0, 200)
  const image = product.imageUrls[0] ?? shop.logoUrl ?? undefined
  const url = `/${shop.slug}/${product._id}`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      locale: shop.language === "fr" ? "fr_FR" : "en_US",
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  }
}

export default async function ProductPage({ params }: PageProps<"/[slug]/[productId]">) {
  const { slug, productId } = await params
  const page = await getProductPage(slug, productId)
  if (!page) notFound()
  if (page.suspended) return <ShopUnavailable name={page.name} language={page.language} />
  const { shop, product } = page
  const t = await getTranslations({ locale: shop.language, namespace: "Public" })
  const tc = await getTranslations({ locale: shop.language, namespace: "Categories" })

  return (
    <ShopLocaleProvider language={shop.language}>
      <ShopLookScope look={shop.look} className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
            <Link
              href={`/${shop.slug}`}
              aria-label={t("backToShop")}
              className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
            >
              <ArrowLeftIcon className="size-5" />
            </Link>
            <ShopHeader shop={shop} profile={shop.look.profile} compact />
          </div>
        </header>
        <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 pt-4 pb-28 md:grid-cols-2 md:gap-10 md:pt-8 md:pb-12">
          <ProductGallery images={product.imageUrls} name={product.name} />
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{tc(product.category)}</p>
              <h1 className="font-heading text-2xl leading-tight font-bold tracking-tight text-balance md:text-3xl">{product.name}</h1>
              {product.soldOut ? (
                <span className="shop-btn w-fit rounded-full bg-[var(--chip,var(--foreground))] px-2.5 py-1 text-xs font-semibold text-[var(--chip-foreground,var(--background))]">
                  {t("soldOut")}
                </span>
              ) : null}
            </div>
            <OrderPanel
                slug={shop.slug}
                whatsappNumber={shop.whatsappNumber}
                currency={shop.currency}
                product={product}
                label={shop.look.buttons.label}
              />
            {product.description ? (
              <section className="flex flex-col gap-2 border-t pt-5">
                <h2 className="text-sm font-medium">{t("description")}</h2>
                <p className="whitespace-pre-line text-pretty text-muted-foreground">{product.description}</p>
              </section>
            ) : null}
          </div>
        </main>
        <div className="hidden md:block">
          <PublicFooter language={shop.language} />
        </div>
      </ShopLookScope>
      <ViewTracker productId={product._id} />
    </ShopLocaleProvider>
  )
}
