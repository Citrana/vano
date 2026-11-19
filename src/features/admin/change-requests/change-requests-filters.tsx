"use client"

import { SearchIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { CHANGE_STATUSES, PROTECTED_FIELDS } from "../../../../convex/lib/changeRequests"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { cn } from "cn"
import { DEFAULT_FILTERS, type ChangeRequestsFilterValue } from "./filter-params"

export { DEFAULT_FILTERS, type ChangeRequestsFilterValue }

/** Search + status, field, a date range (days in UTC) and "flagged only". */
export function ChangeRequestsFilters({
  value,
  onChange,
}: {
  value: ChangeRequestsFilterValue
  onChange: (next: ChangeRequestsFilterValue) => void
}) {
  const t = useTranslations("AdminChangeRequests")
  const ts = useTranslations("ChangeRequests.status")
  const tf = useTranslations("ChangeRequests.fieldName")
  const dirty = JSON.stringify(value) !== JSON.stringify(DEFAULT_FILTERS)
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
          {t("status")}
          <NativeSelect value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as ChangeRequestsFilterValue["status"] })}>
            <option value="">{t("allStatuses")}</option>
            {CHANGE_STATUSES.map((s) => (
              <option key={s} value={s}>{ts(s)}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("field")}
          <NativeSelect value={value.field} onChange={(e) => onChange({ ...value, field: e.target.value as ChangeRequestsFilterValue["field"] })}>
            <option value="">{t("allFields")}</option>
            {PROTECTED_FIELDS.map((f) => (
              <option key={f} value={f}>{tf(f)}</option>
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
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={value.flagged}
            onClick={() => onChange({ ...value, flagged: !value.flagged })}
            className={cn(
              "focus-ring min-h-11 rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none",
              value.flagged ? "chip-selected" : "bg-card hover:bg-muted",
            )}
          >
            {t("flaggedOnly")}
          </button>
          <p className="text-xs text-muted-foreground">{t("utcNote")}</p>
        </div>
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)}>
            {t("clear")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
