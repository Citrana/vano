"use client"

import { HistoryIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/states/states"
import type { ChangeStatus } from "../../../convex/lib/changeRequests"
import { displayValue } from "./display-value"
import { useMyChangeRequests } from "./use-change-requests"

const STATUS_VARIANT: Record<ChangeStatus, "default" | "secondary" | "muted" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "muted",
}

/** The seller's past requests and what the admin decided. */
export function ChangeRequestHistory() {
  const t = useTranslations("ChangeRequests")
  const format = useFormatter()
  const data = useMyChangeRequests()
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium" })

  return (
    <Card aria-labelledby="change-history-title">
      <CardHeader>
        <CardTitle id="change-history-title">{t("historyTitle")}</CardTitle>
        <CardDescription>{t("historyBody")}</CardDescription>
      </CardHeader>
      {data === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : data.requests.length === 0 ? (
        <EmptyState icon={<HistoryIcon />} title={t("historyEmptyTitle")} body={t("historyEmptyBody")} />
      ) : (
        <ul className="flex flex-col divide-y">
          {data.requests.map((r) => (
            <li key={r._id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{t(`fieldName.${r.field}`)}</span>
                <Badge variant={STATUS_VARIANT[r.status]}>{t(`status.${r.status}`)}</Badge>
              </div>
              <p className="break-words text-muted-foreground">
                {displayValue(r.field, r.oldValue)} → <span className="text-foreground">{displayValue(r.field, r.newValue)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t("askedOn", { date: date(r._creationTime) })}
                {r.decidedAt && r.status !== "pending" ? ` · ${t("decidedOn", { date: date(r.decidedAt) })}` : null}
              </p>
              {r.status === "rejected" && r.decisionReason ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">{t("adminReason")}</span> {r.decisionReason}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
