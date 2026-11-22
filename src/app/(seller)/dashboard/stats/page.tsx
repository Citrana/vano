"use client"

import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "../../../../../convex/_generated/api"
import { utcDay } from "../../../../../convex/lib/days"
import { PageTitle } from "@/components/shell/page-title"
import { LockedStatsCard } from "@/features/billing/locked-stats-card"
import { StatsCards } from "@/features/stats/stats-cards"

export default function StatsPage() {
  const t = useTranslations("Stats")
  // Queries can't read the clock, so the client passes "today" (UTC).
  const [today] = useState(() => utcDay(Date.now()))
  const result = useQuery(api.stats.summary, { today })

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageTitle title={t("title")} />
      {/* Without the plan's shop stats: the "Available on {plan}" card. */}
      {result?.locked ? <LockedStatsCard /> : <StatsCards summary={result && !result.locked ? result : undefined} />}
    </div>
  )
}
