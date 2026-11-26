"use client"

import { useMutation, useQuery } from "convex/react"
import { ArrowRightIcon, ExternalLinkIcon, PackageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useCallback, useRef, useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { utcDay } from "../../../../convex/lib/days"
import type { Permission } from "../../../../convex/lib/permissions"
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
import { RoleBadge } from "@/features/team/role-label"

export default function DashboardPage() {
  const t = useTranslations("Dashboard")
  const ts = useTranslations("Seller")
  const shop = useQuery(api.shops.myShop, {})
  // Each part follows the viewer's role in this shop (CLAUDE.md "Team accounts").
  const viewer = useQuery(api.users.viewer, {})
  const can = (p: Permission) => viewer?.permissions.includes(p) ?? false
  const seesProducts = can("ownProducts.view")
  const seesStats = can("ownStats.view")
  const managesShop = can("ownShop.manage")
  const products = useQuery(api.products.listMine, seesProducts ? {} : "skip")
  // Queries can't read the clock, so the client passes "today" (UTC).
  const [today] = useState(() => utcDay(Date.now()))
  const result = useQuery(api.stats.summary, seesStats ? { today } : "skip")
  const summary = result && !result.locked ? result : undefined
  const markLinkShared = useMutation(api.shops.markLinkShared)
  const sharedSent = useRef(false)
  const alreadyShared = shop?.onboarding?.linkSharedAt !== undefined
  // A suspended shop is read-only (the banner explains why).
  const canEdit = shop != null && shop.status !== "suspended"
  const canAddProducts = canEdit && can("ownProducts.manage")
  // Ticks the checklist's "share" step once; a failure (e.g. suspended
  // shop) only means the step stays open.
  const onShared = useCallback(() => {
    if (alreadyShared || !canEdit || !managesShop || sharedSent.current) return
    sharedSent.current = true
    markLinkShared({}).catch(() => {
      sharedSent.current = false
    })
  }, [alreadyShared, canEdit, managesShop, markLinkShared])

  if (shop === undefined || viewer === undefined || (seesProducts && products === undefined)) return <LoadingState />
  if (shop === null) return null // SellerGate redirects to onboarding
  const list = products ?? []
  const overLimitCount = list.filter((p) => p.overLimit).length
  const role = viewer?.shop?.role ?? "owner"

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
              {role === "owner" ? <PlanStatusBadge /> : <RoleBadge role={role} />}
            </div>
            {list.length > 0 ? (
              <p className="text-sm text-muted-foreground">{t("productCount", { count: list.length })}</p>
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
          {managesShop && seesProducts ? (
            <OnboardingChecklist shop={shop} productCount={list.length} canEdit={canEdit} />
          ) : null}

          {/* A short summary: the full list lives on the Products page. */}
          {!seesProducts ? null : list.length === 0 ? (
            <EmptyState
              icon={<PackageIcon />}
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={canAddProducts ? <AddProductButton productCount={0} /> : undefined}
            />
          ) : (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{t("products")}</CardTitle>
                {canAddProducts ? <AddProductButton productCount={list.length} /> : null}
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

        {seesStats ? (
          <div className="lg:col-start-2 lg:row-start-2">
            {result?.locked ? <LockedStatsCard /> : <StatsCards summary={summary} />}
          </div>
        ) : null}
      </div>
    </div>
  )
}
