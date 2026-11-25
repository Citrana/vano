"use client"

import { useQuery } from "convex/react"
import { PlusIcon, TagIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { SALE_STATUSES, saleStatusAt, type SaleStatus } from "../../../convex/lib/sales/active"
import { SALES_MAX } from "../../../convex/lib/sales/rules"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { PlanLockCard } from "@/features/billing/plan-lock-card"
import { useNow } from "@/features/shop-looks/editor/schedule-fields"
import { PromoBarEditor } from "./promo-bar-editor"
import { SaleRow } from "./sale-row"

type Filter = "all" | SaleStatus
const FILTERS: readonly Filter[] = ["all", ...SALE_STATUSES]
const isFilter = (v: string | null): v is Filter => v !== null && (FILTERS as readonly string[]).includes(v)

/** "Available on Pro" + upgrade, for a shop whose plan has no sales. */
export function SalesLockCard({ hasSales }: { hasSales: boolean }) {
  const t = useTranslations("Sales.lock")
  return (
    <PlanLockCard
      feature="salesPromotions"
      title={(plan) => t("title", { plan })}
      body={hasSales ? t("bodyKept") : t("body")}
      action={(plan) => t("action", { plan })}
    />
  )
}

/**
 * The seller's Sales page (CLAUDE.md "Sales"): the Promo bar editor on
 * top, then small status filter chips (in the address, `?status=`) and
 * the compact list, an empty state and, without the plan feature, the
 * "Available on Pro" card (saved sales stay listed; they can be paused or
 * deleted).
 */
export function SalesList() {
  const t = useTranslations("Sales")
  const data = useQuery(api.sales.listMine, {})
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const now = useNow()
  const raw = params.get("status")
  const filter: Filter = isFilter(raw) ? raw : "all"

  if (data === undefined) return <LoadingState />
  const locked = !data.entitled
  const full = data.sales.length >= SALES_MAX
  const shown = filter === "all" ? data.sales : data.sales.filter((s) => saleStatusAt(s, now) === filter)

  const newButton = locked ? null : full ? (
    <span className="text-xs text-muted-foreground">{t("full")}</span>
  ) : (
    <Link href="/dashboard/sales/new" className={buttonVariants()}>
      <PlusIcon />
      {t("new")}
    </Link>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title={t("title")} action={data.sales.length > 0 ? newButton : null} />
      <PromoBarEditor />
      {locked ? <SalesLockCard hasSales={data.sales.length > 0} /> : null}
      {data.sales.length === 0 ? (
        locked ? null : (
          <EmptyState icon={<TagIcon />} title={t("emptyTitle")} body={t("emptyBody")} action={newButton} />
        )
      ) : (
        <>
          <div role="toolbar" aria-label={t("filterLabel")} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  if (key === "all") next.delete("status")
                  else next.set("status", key)
                  const qs = next.toString()
                  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
                }}
                // A small chip inside a 44px tap target.
                className="group flex min-h-11 shrink-0 items-center rounded-full focus-ring"
              >
                <span
                  className={cn(
                    "flex h-8 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
                    filter === key ? "chip-selected" : "bg-card group-hover:bg-muted",
                  )}
                >
                  {key === "all" ? t("filters.all") : t(`status.${key}`)}
                </span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("emptyFilter")}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {shown.map((sale) => (
                <SaleRow key={sale._id} sale={sale} currency={data.currency} now={now} locked={locked} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
