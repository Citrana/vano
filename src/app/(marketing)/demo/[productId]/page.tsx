import type { Metadata } from "next"
import { ArrowLeftIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DEMO_CURRENCY, DEMO_PRODUCTS, DEMO_SLUG, demoProduct } from "@/features/marketing/demo/demo-shop"
import { OrderPanel } from "@/features/public/order-panel"
import { ProductGallery } from "@/features/public/product-gallery"

export function generateStaticParams() {
  return DEMO_PRODUCTS.map((p) => ({ productId: p.id }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: PageProps<"/demo/[productId]">): Promise<Metadata> {
  const { productId } = await params
  const product = demoProduct(productId)
  if (!product) return {}
  const t = await getTranslations("Demo")
  return {
    title: { absolute: `${t(`products.${product.id}.name`)} – ${t("shopName")}` },
    description: t(`products.${product.id}.description`),
    // Sample products: keep them out of search results.
    robots: { index: false },
  }
}

export default async function DemoProductPage({ params }: PageProps<"/demo/[productId]">) {
  const { productId } = await params
  const product = demoProduct(productId)
  if (!product) notFound()
  const t = await getTranslations("Demo")
  const tp = await getTranslations("Public")
  const tc = await getTranslations("Categories")
  const name = t(`products.${product.id}.name`)

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 pt-4 pb-28 md:grid-cols-2 md:gap-10 md:pt-8 md:pb-12">
      <div className="flex flex-col gap-3">
        <Link
          href={`/${DEMO_SLUG}`}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          {t("backToShop")}
        </Link>
        <ProductGallery images={product.photos.map((p) => p.src)} name={name} />
      </div>
      <div className="flex flex-col gap-5 md:pt-14">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{tc(product.category)}</p>
          <h1 className="font-heading text-2xl leading-tight font-bold tracking-tight text-balance md:text-3xl">{name}</h1>
          {product.soldOut ? (
            <span className="w-fit rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">{tp("soldOut")}</span>
          ) : null}
        </div>
        <OrderPanel
          demo
          slug={DEMO_SLUG}
          currency={DEMO_CURRENCY}
          product={{ _id: product.id, name, price: product.price, sizes: product.sizes, colors: product.colors, soldOut: product.soldOut ?? false }}
        />
        <section className="flex flex-col gap-2 border-t pt-5">
          <h2 className="text-sm font-medium">{tp("description")}</h2>
          <p className="text-pretty text-muted-foreground">{t(`products.${product.id}.description`)}</p>
        </section>
      </div>
    </div>
  )
}
