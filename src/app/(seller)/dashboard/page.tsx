"use client"

import { useMutation, useQuery } from "convex/react"
import { ArrowRightIcon, ExternalLinkIcon, PackageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useCallback, useRef, useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { utcDay } from "../../../../convex/lib/days"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { LockedStatsCard } from "@/features/billing/locked-stats-card"
import { PlanStatusBadge } from "@/features/billing/plan-status-badge"
import { AddProductButton, OverLimitNotice } from "@/features/product/products-section"
import { OnboardingChecklist } from "@/features/shop/onboarding-checklist"
import { ShareShopCard } from "@/features/shop/share-shop-card"
import { ShopAvatar } from "@/features/shop/shop-avatar"
import { StatsCards } from "@/features/stats/stats-cards"

export default function DashboardPage() {
  const t = useTranslations("Dashboard")
  const ts = useTranslations("Seller")
  const shop = useQuery(api.shops.myShop, {})
  const products = useQuery(api.products.listMine, {})
  // Queries can't read the clock, so the client passes "today" (UTC).
  const [today] = useState(() => utcDay(Date.now()))
  const result = useQuery(api.stats.summary, { today })
  const summary = result && !result.locked ? result : undefined
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
  const overLimitCount = products.filter((p) => p.overLimit).length

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

      {/* Phones: share card, checklist, products, stats. Desktop: checklist
          and products on the left, share card and stats on the right. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <ShareShopCard name={shop.name} slug={shop.slug} onShared={onShared} />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <OnboardingChecklist shop={shop} productCount={products.length} canEdit={canEdit} />

          {/* A short summary: the full list lives on the Products page. */}
          {products.length === 0 ? (
            <EmptyState
              icon={<PackageIcon />}
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={canEdit ? <AddProductButton productCount={0} /> : undefined}
            />
          ) : (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{t("products")}</CardTitle>
                {canEdit ? <AddProductButton productCount={products.length} /> : null}
              </div>
              <OverLimitNotice count={overLimitCount} />
              <Link
                href="/dashboard/products"
                className={buttonVariants({ variant: "outline", className: "self-start" })}
              >
                {t("manageProducts")}
                <ArrowRightIcon />
              </Link>
            </Card>
          )}
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          {result?.locked ? <LockedStatsCard /> : <StatsCards summary={summary} />}
        </div>
      </div>
    </div>
  )
}
