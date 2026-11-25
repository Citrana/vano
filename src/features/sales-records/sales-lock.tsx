"use client"

import { useTranslations } from "next-intl"
import type { Currency } from "../../../convex/lib/money"
import { PlanLockCard } from "@/features/billing/plan-lock-card"
import { useRecordLabels } from "./use-record-labels"

/**
 * The Sales page without `salesReports`: "Available on {plan}" (the plan
 * name from the plan config), how many sales are kept (never deleted),
 * and a static example of the page, hidden from screen readers.
 */
export function SalesLock({ kept, currency }: { kept: number; currency: Currency }) {
  const t = useTranslations("SalesRecords")
  const labels = useRecordLabels(currency, "UTC")
  const rows = [
    { name: t("sample.dress"), source: t("sources.whatsapp"), qty: 1, total: 4500 },
    { name: t("sample.sandals"), source: t("sources.inPerson"), qty: 2, total: 6000 },
    { name: t("sample.necklace"), source: t("sources.instagram"), qty: 1, total: 1500 },
  ]
  return (
    <div className="flex flex-col gap-4">
      <PlanLockCard
        feature="salesReports"
        title={(plan) => t("lock.title", { plan })}
        body={kept > 0 ? `${t("lock.body")} ${t("lock.bodyKept", { count: kept })}` : t("lock.body")}
        action={(plan) => t("lock.action", { plan })}
      />
      <div aria-hidden className="pointer-events-none relative flex flex-col gap-3 opacity-60 select-none">
        <span className="absolute -top-2 right-2 z-10 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium">{t("sample.label")}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [t("totals.sales"), "3"],
            [t("totals.items"), "4"],
            [t("totals.revenue"), labels.money(12_000)],
            [t("totals.discounts"), labels.money(1500)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-4 py-2.5">
              <span className="size-10 shrink-0 rounded-md bg-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("row.quantity", { count: r.qty })} · {r.source}
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{labels.money(r.total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
