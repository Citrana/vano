"use client"

import { usePaginatedQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { HistoryIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { api } from "../../../convex/_generated/api"
import { canShopDo } from "../../../convex/lib/entitlements"
import { toPlanLimits } from "../../../convex/lib/planFeatures"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PlanLockCard } from "@/features/billing/plan-lock-card"
import { useShopLimits } from "@/features/billing/use-billing"
import { useRoleName } from "@/features/team/role-label"

type Row = FunctionReturnType<typeof api.activity.list>["page"][number]
const PAGE = 30

/**
 * The shop's activity history (CLAUDE.md "Team accounts"): who did what,
 * newest first, grouped by day. Owner and Managers; Business only (the
 * history is kept on every plan and shows again after an upgrade; the
 * server returns nothing while locked).
 */
export function ActivityPage() {
  const t = useTranslations("Activity")
  const format = useFormatter()
  const limits = useShopLimits()
  const { results, status, loadMore } = usePaginatedQuery(api.activity.list, {}, { initialNumItems: PAGE })

  if (status === "LoadingFirstPage" || limits === undefined) return <LoadingState />
  const locked = limits !== null && canShopDo(toPlanLimits(limits.limits), { kind: "feature", feature: "teamRoles" }) !== null

  const days: { day: string; rows: Row[] }[] = []
  for (const row of results) {
    const day = format.dateTime(row.at, { dateStyle: "full" })
    const last = days.at(-1)
    if (last?.day === day) last.rows.push(row)
    else days.push({ day, rows: [row] })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title={t("title")} />
      <p className="-mt-3 text-sm text-muted-foreground">{t("subtitle")}</p>
      {locked ? (
        <PlanLockCard
          feature="teamRoles"
          title={(plan) => t("lock.title", { plan })}
          body={t("lock.body")}
          action={(plan) => t("lock.action", { plan })}
        />
      ) : results.length === 0 ? (
        <EmptyState icon={<HistoryIcon />} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        days.map(({ day, rows }) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-muted-foreground">{day}</h2>
            <Card className="gap-0 divide-y p-0">
              {rows.map((row) => (
                <ActivityLine key={row._id} row={row} />
              ))}
            </Card>
          </section>
        ))
      )}
      {!locked && status === "CanLoadMore" ? (
        <Button variant="outline" className="self-center" onClick={() => loadMore(PAGE)}>
          {t("more")}
        </Button>
      ) : null}
    </div>
  )
}

function ActivityLine({ row }: { row: Row }) {
  const t = useTranslations("Activity")
  const format = useFormatter()
  const roleName = useRoleName()
  const who = row.actor.isYou ? t("you") : row.actor.label
  const values = {
    target: row.targetLabel || t("someone"),
    role: row.details?.role ? roleName(row.details.role) : "",
    previousRole: row.details?.previousRole ? roleName(row.details.previousRole) : "",
    field: row.details?.field ? t(`fields.${row.details.field as "name" | "slug" | "whatsapp"}`) : "",
  }
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-heading text-xs font-bold"
      >
        {(row.actor.label.trim().charAt(0) || "?").toUpperCase()}
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{who}</span>
        {row.actor.isOwner && !row.actor.isYou ? <span className="text-muted-foreground"> ({t("owner")})</span> : null}{" "}
        <span className="break-words">{t(`kinds.${row.kind}`, values)}</span>
      </p>
      <time dateTime={new Date(row.at).toISOString()} className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {format.dateTime(row.at, { timeStyle: "short" })}
      </time>
    </div>
  )
}
