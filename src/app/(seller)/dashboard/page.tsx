"use client"

import { useQuery } from "convex/react"
import { PackageIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo, useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { utcDay } from "../../../../convex/lib/days"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { ProductRow } from "@/features/product/product-row"
import { ShareShopCard } from "@/features/shop/share-shop-card"
import { StatsCards } from "@/features/stats/stats-cards"

export default function DashboardPage() {
  const t = useTranslations("Dashboard")
  const shop = useQuery(api.shops.myShop, {})
  const products = useQuery(api.products.listMine, {})
  // Queries can't read the clock, so the client passes "today" (UTC).
  const [today] = useState(() => utcDay(Date.now()))
  const summary = useQuery(api.stats.summary, { today })
  const perProduct = useMemo(
    () => new Map(summary?.products.map((p) => [p.productId, p]) ?? []),
    [summary],
  )

  if (shop === undefined || products === undefined) return <LoadingState />
  if (shop === null) return null // SellerGate redirects to onboarding
  // A suspended shop is read-only (the banner explains why).
  const canAdd = shop.status !== "suspended"

  const addButton = (
    <Link href="/dashboard/products/new" className={buttonVariants()}>
      <PlusIcon />
      {t("addProduct")}
    </Link>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <section className="flex flex-col gap-4 lg:order-1" aria-labelledby="products-title">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 id="products-title" className="font-heading text-2xl font-bold tracking-tight">
              {shop.name}
            </h1>
            <p className="text-sm text-muted-foreground">{t("productCount", { count: products.length })}</p>
          </div>
          {products.length > 0 && canAdd ? addButton : null}
        </div>
        {products.length === 0 ? (
          <EmptyState
            icon={<PackageIcon />}
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={canAdd ? addButton : undefined}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {products.map((product) => (
              <ProductRow
                key={product._id}
                product={product}
                currency={shop.currency}
                stats={perProduct.get(product._id) ?? { views: 0, whatsappClicks: 0 }}
              />
            ))}
          </ul>
        )}
      </section>
      <aside className="flex flex-col gap-4 lg:order-2 lg:sticky lg:top-20">
        <ShareShopCard name={shop.name} slug={shop.slug} />
        <StatsCards summary={summary} />
      </aside>
    </div>
  )
}
