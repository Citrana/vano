"use client"

import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { AUDIT_ACTIONS, type AuditAction } from "../../../../convex/lib/audit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"

export type ActivityFilterValue = {
  actor: "" | "system" | Id<"users">
  action: "" | AuditAction
  /** "YYYY-MM-DD" (UTC) or "" */
  from: string
  to: string
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilterValue = { actor: "", action: "", from: "", to: "" }

/** Person, action and date-range filters (days in UTC). */
export function ActivityFilters({
  value,
  onChange,
}: {
  value: ActivityFilterValue
  onChange: (next: ActivityFilterValue) => void
}) {
  const t = useTranslations("AdminActivity")
  const ta = useTranslations("AuditActions")
  const actors = useQuery(api.admin.audit.actors, {})
  const dirty = value.actor !== "" || value.action !== "" || value.from !== "" || value.to !== ""

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("person")}
          <NativeSelect value={value.actor} onChange={(e) => onChange({ ...value, actor: e.target.value as ActivityFilterValue["actor"] })}>
            <option value="">{t("allPeople")}</option>
            <option value="system">{t("system")}</option>
            {actors?.map((a) => (
              <option key={a._id} value={a._id}>{a.email}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("action")}
          <NativeSelect value={value.action} onChange={(e) => onChange({ ...value, action: e.target.value as ActivityFilterValue["action"] })}>
            <option value="">{t("allActions")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>{ta(a)}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("from")}
          <Input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("to")}
          <Input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("utcNote")}</p>
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_ACTIVITY_FILTERS)}>
            {t("clear")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
