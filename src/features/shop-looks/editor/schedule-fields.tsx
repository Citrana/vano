"use client"

import { useTranslations } from "next-intl"
import { useEffect, useId, useState } from "react"
import { cn } from "cn"
import { PROMO_MAX_DAYS, scheduleProblem } from "../../../../convex/lib/looks/schedule"
import { saleScheduleProblem } from "../../../../convex/lib/sales/rules"
import { fromLocalInput, toLocalInput } from "@/lib/local-time"
import { Input } from "@/components/ui/input"
import { ChoiceGroup } from "./choice-group"

type Schedule = { startsAt?: number; endsAt?: number }

type Mode = "always" | "now" | "dates"

/**
 * Start / end, in the seller's local time, stored as UTC (schedule.ts
 * rules). `variant="promo"` (event banners, profile decorations): "always"
 * or dates, written to the draft only when the order is valid.
 * `variant="sale"` (CLAUDE.md "Sales"): "start now" or a start, and an end
 * always (sales/rules.ts adds "the end is in the future").
 */
export function ScheduleFields({
  schedule,
  disabled,
  now,
  onCommit,
  variant = "promo",
}: {
  schedule: Schedule
  disabled: boolean
  now: number
  onCommit: (dates: { startsAt?: number; endsAt?: number }) => void
  variant?: "promo" | "sale"
}) {
  const t = useTranslations("EventBanners.schedule")
  const id = useId()
  const sale = variant === "sale"
  const [mode, setMode] = useState<Mode>(
    sale ? (schedule.startsAt !== undefined ? "dates" : "now") : schedule.startsAt !== undefined || schedule.endsAt !== undefined ? "dates" : "always",
  )
  const [start, setStart] = useState(toLocalInput(schedule.startsAt))
  const [end, setEnd] = useState(toLocalInput(schedule.endsAt))
  const datesFor = (m: Mode, s: string, e: string): Schedule =>
    m === "always" ? {} : { startsAt: m === "now" ? undefined : fromLocalInput(s), endsAt: fromLocalInput(e) }
  const dates = datesFor(mode, start, end)
  const problem = sale
    ? dates.endsAt === undefined
      ? "missingEnd"
      : saleScheduleProblem({ startsAt: dates.startsAt, endsAt: dates.endsAt }, now)
    : scheduleProblem(dates, now)
  const ended = !sale && problem === null && dates.endsAt !== undefined && dates.endsAt <= now

  function commit(nextMode: Mode, nextStart: string, nextEnd: string) {
    const next = datesFor(nextMode, nextStart, nextEnd)
    // A sale's form validates (and shows) every problem itself.
    if (sale || scheduleProblem(next, now) !== "order") onCommit(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <ChoiceGroup
        label={t("title")}
        value={mode}
        disabled={disabled}
        onChange={(m) => {
          setMode(m)
          commit(m, start, end)
        }}
        options={[
          sale ? { value: "now", label: t("startNow") } : { value: "always", label: t("always") },
          { value: "dates", label: sale ? t("pickStart") : t("dates") },
        ]}
      />
      {mode !== "always" ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["start", start, setStart, t("start"), t("startHelp")],
                ["end", end, setEnd, t("end"), sale ? t("saleEndHelp") : t("endHelp")],
              ] as const
            )
              .filter(([key]) => key === "end" || mode === "dates")
              .map(([key, value, set, label, help]) => (
              <div key={key} className="flex flex-col gap-2">
                <label htmlFor={`${id}-${key}`} className="text-sm font-medium">
                  {label}
                </label>
                <Input
                  id={`${id}-${key}`}
                  type="datetime-local"
                  value={value}
                  disabled={disabled}
                  aria-describedby={`${id}-${key}-help ${id}-problem`}
                  onChange={(e) => {
                    set(e.target.value)
                    if (key === "start") commit(mode, e.target.value, end)
                    else commit(mode, start, e.target.value)
                  }}
                />
                <p id={`${id}-${key}-help`} className="text-xs text-muted-foreground">
                  {help}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("timezone")}</p>
          <p id={`${id}-problem`} role="status" className={cn("text-sm", problem ? "text-destructive" : "text-tag-warning-foreground")}>
            {problem === "missingEnd"
              ? t("missingEnd")
              : problem === "order"
              ? t("order")
              : problem === "tooFar"
                ? t("tooFar")
                : problem === "tooLong"
                  ? t("tooLong", { days: PROMO_MAX_DAYS })
                  : problem === "ended"
                    ? t("saleEnded")
                    : ended
                    ? t("ended")
                    : null}
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** The clock, for status lines (re-read every minute). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}
