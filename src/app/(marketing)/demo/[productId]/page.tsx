import type { Metadata } from "next"
import { ArrowLeftIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DEMO_CURRENCY, DEMO_PRODUCTS, DEMO_SLUG, demoProduct } from "@/features/marketing/demo/demo-shop"
import { ConditionTag } from "@/features/public/condition-tag"
import { OrderPanel } from "@/features/public/order-panel"
import { ProductGallery } from "@/features/public/product-gallery"
import { ProductSection } from "@/features/public/product-section"

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
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pt-6 md:pb-16">
      <Link
        href={`/${DEMO_SLUG}`}
        className="-ml-2 mb-3 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:bg-muted"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t("backToShop")}
      </Link>
      <div className="grid gap-6 md:grid-cols-2 md:gap-10 lg:gap-14">
        <ProductGallery images={product.photos.map((p) => p.src)} name={name} />
        <div className="flex flex-col gap-6 md:sticky md:top-32 md:self-start">
          <div className="flex flex-col gap-2">
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {tc(product.category)}
                {product.condition ? <ConditionTag label={tp(`conditions.${product.condition}`)} /> : null}
              </p>
            <h1 className="font-heading text-2xl leading-tight font-bold tracking-tight text-balance md:text-3xl">{name}</h1>
            {product.soldOut ? (
              <span className="shop-btn w-fit rounded-full bg-[var(--chip,var(--foreground))] px-2.5 py-1 text-xs font-semibold text-[var(--chip-foreground,var(--background))]">
                {tp("soldOut")}
              </span>
            ) : product.fewLeft ? (
              <span className="shop-btn w-fit rounded-full border border-[var(--chip,var(--foreground))] bg-[var(--chip-soft,var(--muted))] px-2.5 py-1 text-xs font-semibold text-[var(--chip-soft-foreground,var(--foreground))]">
                {tp("fewLeft")}
              </span>
            ) : null}
          </div>
          <OrderPanel
            demo
            slug={DEMO_SLUG}
            currency={DEMO_CURRENCY}
            product={{ _id: product.id, name, price: product.price, sizes: product.sizes, colors: product.colors, soldOut: product.soldOut ?? false }}
          />
          <div>
            <ProductSection title={tp("description")} open>
              <p className="text-pretty text-muted-foreground">{t(`products.${product.id}.description`)}</p>
            </ProductSection>
          </div>
        </div>
      </div>
    </div>
  )
}
