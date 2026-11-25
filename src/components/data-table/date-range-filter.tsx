"use client"

import { CalendarIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { enUS, fr } from "react-day-picker/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useNow } from "@/features/billing/use-billing"
import { datePresets } from "./date-presets"

const toDate = (day: string) => (day ? new Date(`${day}T12:00:00Z`) : undefined)
const toDay = (date: Date | undefined) => (date ? date.toISOString().slice(0, 10) : "")

/** "1–15 Nov 2026", "From 1 Nov 2026", "Until 15 Nov 2026", or null. Days are UTC. */
export function useRangeLabel() {
  const t = useTranslations("DataTable")
  const format = useFormatter()
  const opts = { dateStyle: "medium", timeZone: "UTC" } as const
  return (from: string, to: string): string | null => {
    if (from && to) return format.dateTimeRange(toDate(from)!, toDate(to)!, opts)
    if (from) return t("dateFrom", { date: format.dateTime(toDate(from)!, opts) })
    if (to) return t("dateTo", { date: format.dateTime(toDate(to)!, opts) })
    return null
  }
}

/**
 * A date range picker (calendar in a popover) for list filters. Values
 * stay "YYYY-MM-DD": UTC days like the server's day ranges, or days in
 * `timeZone` when given (a shop's recorded sales).
 */
export function DateRangeFilter({
  label,
  from,
  to,
  onChange,
  timeZone,
}: {
  label: string
  from: string
  to: string
  onChange: (from: string, to: string) => void
  timeZone?: string
}) {
  const t = useTranslations("DataTable")
  const locale = useLocale()
  const rangeLabel = useRangeLabel()
  const { today, presets: ranges } = datePresets(useNow(), timeZone)
  const presets = ranges.map((p) => ({ ...p, label: t(p.key) }))

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-medium" />}>
          <CalendarIcon className="text-muted-foreground" />
          <span className="truncate">{rangeLabel(from, to) ?? t("anyDate")}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto gap-3 p-3" aria-label={label}>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                aria-pressed={from === p.from && to === p.to}
                className="rounded-full aria-pressed:chip-selected"
                onClick={() => onChange(p.from, p.to)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            timeZone="UTC"
            noonSafe
            locale={locale === "fr" ? fr : enUS}
            defaultMonth={toDate(to || from)}
            selected={{ from: toDate(from), to: toDate(to) }}
            onSelect={(range) => onChange(toDay(range?.from), toDay(range?.to))}
            disabled={{ after: toDate(today)! }}
          />
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <p className="text-xs text-muted-foreground">{timeZone ? t("zoneNote", { zone: timeZone }) : t("utcNote")}</p>
            {from || to ? (
              <Button variant="ghost" size="sm" onClick={() => onChange("", "")}>
                {t("clearDates")}
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
