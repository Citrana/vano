"use client"

import { useMutation, useQuery } from "convex/react"
import { ExternalLinkIcon, EyeOffIcon, PackageIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useCallback, useMemo, useRef, useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { utcDay } from "../../../../convex/lib/days"
import { canShopDo } from "../../../../convex/lib/entitlements"
import { PLAN_LIMITS } from "../../../../convex/lib/plans"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { LockedStatsCard } from "@/features/billing/locked-stats-card"
import { PlanStatusBadge } from "@/features/billing/plan-status-badge"
import { DecisionNotice } from "@/features/change-requests/decision-notice"
import { useMyBilling } from "@/features/billing/use-billing"
import { ProductRow } from "@/features/product/product-row"
import { OnboardingChecklist } from "@/features/shop/onboarding-checklist"
import { ShareShopCard } from "@/features/shop/share-shop-card"
import { ShopAvatar } from "@/features/shop/shop-avatar"
import { StatsCards } from "@/features/stats/stats-cards"

export default function DashboardPage() {
  const t = useTranslations("Dashboard")
  const ts = useTranslations("Seller")
  const shop = useQuery(api.shops.myShop, {})
  const products = useQuery(api.products.listMine, {})
  const billing = useMyBilling()
  // Queries can't read the clock, so the client passes "today" (UTC).
  const [today] = useState(() => utcDay(Date.now()))
  const result = useQuery(api.stats.summary, { today })
  const summary = result && !result.locked ? result : undefined
  const perProduct = useMemo(
    () => new Map(summary?.products.map((p) => [p.productId, p]) ?? []),
    [summary],
  )
  const markLinkShared = useMutation(api.shops.markLinkShared)
  const sharedSent = useRef(false)
  const alreadyShared = shop?.onboarding?.linkSharedAt !== undefined
  // A suspended shop is read-only (the banner explains why).
  const canEdit = shop != null && shop.status !== "suspended"
  // Ticks the checklist's "share" step once; a failure (e.g. suspended
  // shop) only means the step stays open.
  const onShared = useCallback(() => {
    if (alreadyShared || !canEdit || sharedSent.current) return
    sharedSent.current = true
    markLinkShared({}).catch(() => {
      sharedSent.current = false
    })
  }, [alreadyShared, canEdit, markLinkShared])

  if (shop === undefined || products === undefined) return <LoadingState />
  if (shop === null) return null // SellerGate redirects to onboarding
  // At the plan's product limit, the add button becomes an upgrade link.
  const limits = billing ? PLAN_LIMITS[billing.effectivePlan] : null
  const atLimit = limits !== null && canShopDo(limits, { kind: "addProduct", products: products.length }) !== null
  const overLimitCount = products.filter((p) => p.overLimit).length

  const addButton = atLimit ? (
    <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline" })}>
      {t("upgrade")}
    </Link>
  ) : (
    <Link href="/dashboard/products/new" className={buttonVariants()}>
      <PlusIcon />
      {t("addProduct")}
    </Link>
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <ShopAvatar name={shop.name} logoUrl={shop.logoUrl} />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h1 id="shop-title" className="truncate font-heading text-2xl font-bold tracking-tight">
                {shop.name}
              </h1>
              <PlanStatusBadge />
            </div>
            {products.length > 0 ? (
              <p className="text-sm text-muted-foreground">{t("productCount", { count: products.length })}</p>
            ) : null}
          </div>
        </div>
        <a
          href={`/${shop.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          <ExternalLinkIcon />
          {ts("viewShop")}
        </a>
      </header>

      <DecisionNotice canDismiss={canEdit} />

      {/* Phones: share card, checklist, products, stats. Desktop: checklist
          and products on the left, share card and stats on the right. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <ShareShopCard name={shop.name} slug={shop.slug} onShared={onShared} />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <OnboardingChecklist shop={shop} productCount={products.length} canEdit={canEdit} />

          <section className="flex flex-col gap-4" aria-labelledby="products-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="products-title" className="font-heading text-lg font-bold tracking-tight">
                {t("products")}
              </h2>
              {products.length > 0 && canEdit ? addButton : null}
            </div>
            {atLimit && limits?.products != null ? (
              <p className="text-sm text-muted-foreground">{t("limitReached", { count: limits.products })}</p>
            ) : null}
            {overLimitCount > 0 ? (
              <p role="status" className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
                <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t("overLimitNotice", { count: overLimitCount })}
              </p>
            ) : null}
            {products.length === 0 ? (
              <EmptyState
                icon={<PackageIcon />}
                title={t("emptyTitle")}
                body={t("emptyBody")}
                action={canEdit ? addButton : undefined}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {products.map((product) => (
                  <ProductRow
                    key={product._id}
                    product={product}
                    currency={shop.currency}
                    stats={summary ? (perProduct.get(product._id) ?? { views: 0, whatsappClicks: 0 }) : undefined}
                    overLimitMode={overLimitCount > 0}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          {result?.locked ? <LockedStatsCard /> : <StatsCards summary={summary} />}
        </div>
      </div>
    </div>
  )
}
