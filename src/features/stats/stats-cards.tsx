"use client"

import { EyeIcon, MessageCircleIcon, StoreIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { cn } from "cn"
import { Card, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Totals = { shopViews: number; productViews: number; whatsappClicks: number }
export type StatsSummary = { today: Totals; last7: Totals; last30: Totals }

const PERIODS = ["today", "last7", "last30"] as const

/** Shop views, product views, WhatsApp order clicks for a chosen period. */
export function StatsCards({ summary }: { summary: StatsSummary | undefined }) {
  const t = useTranslations("Stats")
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("last7")
  const totals = summary?.[period]
  const tiles = [
    { key: "shopViews" as const, icon: StoreIcon },
    { key: "productViews" as const, icon: EyeIcon },
    { key: "whatsappClicks" as const, icon: MessageCircleIcon },
  ]

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        <div role="tablist" aria-label={t("title")} className="inline-flex rounded-lg bg-muted p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === period}
              onClick={() => setPeriod(p)}
              className={cn(
                "min-h-9 rounded-md px-3 text-xs font-medium md:min-h-7",
                p === period ? "bg-card shadow-sm" : "text-muted-foreground"
              )}
            >
              {t(p)}
            </button>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map(({ key, icon: Icon }) => (
          <div key={key} className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="leading-tight">{t(key)}</span>
            </dt>
            <dd className="font-heading text-2xl font-semibold tabular-nums">
              {totals ? totals[key].toLocaleString() : <Skeleton className="h-7 w-10" />}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
