"use client"

import { SearchIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { addDays, dayStartMs, isDay } from "../../../../convex/lib/days"
import { PLAN_IDS, type PlanId } from "../../../../convex/lib/plans"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"

export type BillingFilterValue<S extends string> = {
  search: string
  plan: "" | PlanId
  status: "" | S
  /** "YYYY-MM-DD" (UTC) or "" */
  from: string
  to: string
}

export function emptyFilters<S extends string>(): BillingFilterValue<S> {
  return { search: "", plan: "", status: "", from: "", to: "" }
}

/** The picked days as a [from, to) range in ms; "to" covers the whole day. */
export function dayRange(value: { from: string; to: string }): { from?: number; to?: number } {
  return {
    from: isDay(value.from) ? dayStartMs(value.from) : undefined,
    to: isDay(value.to) ? dayStartMs(addDays(value.to, 1)) : undefined,
  }
}

/** Shop name search, plan, status and a date range (days in UTC). */
export function BillingFilters<S extends string>({
  value,
  onChange,
  statuses,
  statusLabel,
  fromLabel,
  toLabel,
}: {
  value: BillingFilterValue<S>
  onChange: (next: BillingFilterValue<S>) => void
  statuses: readonly S[]
  statusLabel: (status: S) => string
  fromLabel: string
  toLabel: string
}) {
  const t = useTranslations("AdminBilling")
  const tp = useTranslations("Pricing.plans")
  const dirty = Object.values(value).some((v) => v !== "")
  return (
    <div className="flex flex-col gap-2">
      <label className="relative">
        <span className="sr-only">{t("search")}</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("plan")}
          <NativeSelect value={value.plan} onChange={(e) => onChange({ ...value, plan: e.target.value as BillingFilterValue<S>["plan"] })}>
            <option value="">{t("allPlans")}</option>
            {PLAN_IDS.map((p) => (
              <option key={p} value={p}>{tp(`${p}.name`)}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("status")}
          <NativeSelect value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as BillingFilterValue<S>["status"] })}>
            <option value="">{t("allStatuses")}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {fromLabel}
          <Input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {toLabel}
          <Input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("utcNote")}</p>
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(emptyFilters<S>())}>
            {t("clear")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
