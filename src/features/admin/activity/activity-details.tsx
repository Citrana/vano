"use client"

import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { HistoryIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../../convex/_generated/api"
import type { AuditTargetType } from "../../../../convex/lib/audit"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { DetailItem, DetailList } from "@/components/data-table/detail-list"
import { adminHref } from "../shell/hrefs"

export type ActivityEntry = NonNullable<FunctionReturnType<typeof api.admin.audit.get>>

/** Detail keys written by the audit log (see AuditDetails in messages). */
const DETAIL_KEYS = [
  "permissions", "added", "removed", "renamedFrom", "from", "to", "owner", "products", "force",
  "plan", "previousPlan", "days", "reason", "periodEnd", "previousEnd", "amount", "provider", "reference", "shop",
  "requestId", "field", "newValue", "flags", "cooldownOverridden", "scope", "bannerText", "bannerPhoto", "promoHeadline", "decoration",
  "feature", "value", "endsAt", "fromVersion", "toVersion", "lowered", "sale", "code", "records",
] as const
type DetailKey = (typeof DETAIL_KEYS)[number]
const isDetailKey = (key: string): key is DetailKey => (DETAIL_KEYS as readonly string[]).includes(key)

/** Where a target opens (products and settings have no page). Subscription entries target the shop id. */
const TARGET_HREF: Partial<Record<AuditTargetType, (id: string) => string>> = {
  user: adminHref.user,
  shop: adminHref.shop,
  role: adminHref.role,
  subscription: adminHref.shop,
  planConfig: () => "/admin/plans",
}

export function useActorLabel() {
  const t = useTranslations("AdminActivity")
  return (e: Pick<ActivityEntry, "actorId" | "actorEmail">) => (e.actorId ? e.actorEmail : t("system"))
}

/** The activity drawer: who did what, to whom, when, with every detail. */
export function ActivityDetails({ entryId }: { entryId: string }) {
  const t = useTranslations("AdminActivity")
  const ta = useTranslations("AuditActions")
  const td = useTranslations("AuditDetails")
  const format = useFormatter()
  const actor = useActorLabel()
  const entry = useQuery(api.admin.audit.get, { entryId })

  if (entry === undefined) return <LoadingState />
  if (entry === null) return <EmptyState icon={<HistoryIcon />} title={t("notFoundTitle")} body={t("notFoundBody")} />

  // Unknown keys (e.g. from a future action) fall back to the raw key.
  const detailLabel = (key: string) => (isDetailKey(key) ? td(key) : key)
  const detailValue = (value: string | number | boolean | null) =>
    typeof value === "boolean" ? (value ? t("yes") : t("no")) : String(value)
  const details = Object.entries(entry.details ?? {}).filter(([, v]) => v !== "" && v !== null)
  const href = TARGET_HREF[entry.targetType]?.(entry.targetId)

  return (
    <>
      <div className="flex flex-col gap-2">
        <Badge variant="secondary">{ta(entry.action)}</Badge>
        <time dateTime={new Date(entry.at).toISOString()} className="text-sm text-muted-foreground">
          {format.dateTime(new Date(entry.at), { dateStyle: "long", timeStyle: "medium" })}
        </time>
      </div>
      <DetailList className="rounded-xl border bg-card p-4">
        <DetailItem label={t("person")}>{actor(entry)}</DetailItem>
        <DetailItem label={t("target")}>
          {href ? (
            <Link href={href} className="font-medium break-all hover:underline">
              {entry.targetLabel}
            </Link>
          ) : (
            <span className="break-all">{entry.targetLabel}</span>
          )}
        </DetailItem>
        {details.map(([key, value]) => (
          <DetailItem key={key} label={detailLabel(key)}>
            {detailValue(value)}
          </DetailItem>
        ))}
      </DetailList>
    </>
  )
}
