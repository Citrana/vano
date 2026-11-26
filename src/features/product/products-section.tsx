"use client"

import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { EyeOffIcon, PackageIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo, useState } from "react"
import { api } from "../../../convex/_generated/api"
import { utcDay } from "../../../convex/lib/days"
import { canShopDo } from "../../../convex/lib/entitlements"
import { toPlanLimits } from "../../../convex/lib/planFeatures"
import { EmptyState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { useShopLimits } from "@/features/billing/use-billing"
import { ProductRow } from "./product-row"

type Shop = NonNullable<FunctionReturnType<typeof api.shops.myShop>>
type Products = FunctionReturnType<typeof api.products.listMine>

/** The plan's product limit for the shop (null while the plan loads). */
export function useProductLimit(productCount: number) {
  const billing = useShopLimits()
  const limits = billing ? toPlanLimits(billing.limits) : null
  const atLimit = limits !== null && canShopDo(limits, { kind: "addProduct", products: productCount }) !== null
  return { limit: limits?.products ?? null, atLimit }
}

/** "Add product", or an upgrade link at the plan's product limit. */
export function AddProductButton({ productCount }: { productCount: number }) {
  const t = useTranslations("Dashboard")
  const { atLimit } = useProductLimit(productCount)
  return atLimit ? (
    <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline" })}>
      {t("upgrade")}
    </Link>
  ) : (
    <Link href="/dashboard/products/new" className={buttonVariants()}>
      <PlusIcon />
      {t("addProduct")}
    </Link>
  )
}

/** Shown when products are hidden by the plan's limit. */
export function OverLimitNotice({ count }: { count: number }) {
  const t = useTranslations("Dashboard")
  if (count === 0) return null
  return (
    <p role="status" className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
      <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {t("overLimitNotice", { count })}
    </p>
  )
}

/** The Products page body: limit notices, then the list (or the empty state). */
export function ProductsSection({ shop, products, canEdit }: { shop: Shop; products: Products; canEdit: boolean }) {
  const t = useTranslations("Dashboard")
  const { limit, atLimit } = useProductLimit(products.length)
  // Queries can't read the clock, so the client passes "today" (UTC).
  const [today] = useState(() => utcDay(Date.now()))
  // Views / clicks per product only for a role that sees stats (CLAUDE.md "Team accounts").
  const viewer = useQuery(api.users.viewer, {})
  const seesStats = viewer?.permissions.includes("ownStats.view") ?? false
  const result = useQuery(api.stats.summary, seesStats ? { today } : "skip")
  const summary = result && !result.locked ? result : undefined
  const perProduct = useMemo(() => new Map(summary?.products.map((p) => [p.productId, p]) ?? []), [summary])
  const overLimitCount = products.filter((p) => p.overLimit).length

  return (
    <div className="flex flex-col gap-4">
      {atLimit && limit != null ? <p className="text-sm text-muted-foreground">{t("limitReached", { count: limit })}</p> : null}
      <OverLimitNotice count={overLimitCount} />
      {products.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={canEdit ? <AddProductButton productCount={0} /> : undefined}
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
    </div>
  )
}
