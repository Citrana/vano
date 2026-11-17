"use client"

import { ArrowRightIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { AuditAction, AuditDetails, AuditTargetType } from "../../../../convex/lib/audit"
import { Badge } from "@/components/ui/badge"

export type ActivityEntry = {
  _id: Id<"auditLogs">
  at: number
  actorId: Id<"users"> | null
  actorEmail: string
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  targetLabel: string
  details: AuditDetails | null
}

/** Detail keys written by the audit log (see AuditDetails in messages). */
const DETAIL_KEYS = ["permissions", "added", "removed", "renamedFrom", "from", "to", "owner", "products", "force"] as const
type DetailKey = (typeof DETAIL_KEYS)[number]
const isDetailKey = (key: string): key is DetailKey => (DETAIL_KEYS as readonly string[]).includes(key)

/** Admin pages that still exist for a target type (products/settings have none). */
const TARGET_PAGES: Partial<Record<AuditTargetType, string>> = {
  user: "/admin/users/",
  shop: "/admin/shops/",
  role: "/admin/roles/",
}

/** One card per entry: action, actor → target, time, details. */
export function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  const t = useTranslations("AdminActivity")
  const ta = useTranslations("AuditActions")
  const td = useTranslations("AuditDetails")
  const format = useFormatter()

  // Unknown keys (e.g. from a future action) fall back to the raw key.
  const detailLabel = (key: string) => (isDetailKey(key) ? td(key) : key)
  const detailValue = (value: string | number | boolean | null) =>
    typeof value === "boolean" ? (value ? t("yes") : t("no")) : String(value)

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e) => {
        const page = TARGET_PAGES[e.targetType]
        const details = Object.entries(e.details ?? {}).filter(([, v]) => v !== "" && v !== null)
        return (
          <li key={e._id} className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary">{ta(e.action)}</Badge>
              <time dateTime={new Date(e.at).toISOString()} className="text-xs text-muted-foreground">
                {format.dateTime(new Date(e.at), { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm break-all">
              <span className="font-medium">{e.actorId ? e.actorEmail : t("system")}</span>
              <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {page ? (
                <Link href={`${page}${e.targetId}`} className="hover:underline">
                  {e.targetLabel}
                </Link>
              ) : (
                <span>{e.targetLabel}</span>
              )}
            </p>
            {details.length > 0 ? (
              <dl className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {details.map(([key, value]) => (
                  <div key={key} className="flex gap-1">
                    <dt className="shrink-0">{detailLabel(key)}:</dt>
                    <dd className="break-words">{detailValue(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
