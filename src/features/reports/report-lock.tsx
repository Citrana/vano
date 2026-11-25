"use client"

import { useTranslations } from "next-intl"
import type { Currency } from "../../../convex/lib/money"
import { StatTile } from "@/components/stats/stat-tile"
import { PlanLockCard } from "@/features/billing/plan-lock-card"
import { useRecordLabels } from "@/features/sales-records/use-record-labels"

const SAMPLE_BARS = [2, 0, 4, 3, 0, 6, 8, 1, 0, 5, 7, 3, 2, 0, 9, 4, 6, 0, 3, 5, 10, 2, 0, 4, 6, 3, 7, 0, 5, 8]

/**
 * Reports without `salesReports`: "Available on {plan}" (the plan name
 * from the plan config), how many sales are kept, and a static example
 * report hidden from screen readers.
 */
export function ReportLock({ kept, currency }: { kept: number; currency: Currency }) {
  const t = useTranslations("Reports")
  const labels = useRecordLabels(currency, "UTC")
  const max = Math.max(...SAMPLE_BARS)
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
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <StatTile tone="card" label={t("cards.revenue")} value={labels.money(1_840_000)} />
          <StatTile tone="card" label={t("cards.items")} value="12" />
          <StatTile tone="card" label={t("cards.sales")} value="9" />
          <StatTile tone="card" label={t("cards.average")} value={labels.money(204_400)} />
        </dl>
        <div className="flex h-28 items-end gap-[2px] rounded-xl border bg-card p-3">
          {SAMPLE_BARS.map((v, i) => (
            <div key={i} className="flex-1 rounded-t-[4px] bg-chart" style={{ height: `${(v / max) * 100}%` }} />
          ))}
        </div>
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {[t("sample.dress"), t("sample.sandals"), t("sample.necklace")].map((name, i) => (
            <li key={name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate font-medium">{name}</span>
              <span className="tabular-nums">{labels.money([760_000, 540_000, 320_000][i])}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
