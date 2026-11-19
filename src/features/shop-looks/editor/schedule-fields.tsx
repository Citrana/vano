"use client"

import { useTranslations } from "next-intl"
import { useEffect, useId, useState } from "react"
import { cn } from "cn"
import { PROMO_MAX_DAYS, scheduleProblem } from "../../../../convex/lib/looks/schedule"
import { Input } from "@/components/ui/input"
import { ChoiceGroup } from "./choice-group"

type Schedule = { startsAt?: number; endsAt?: number }

/** Local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
function toLocalInput(ms: number | undefined): string {
  if (ms === undefined) return ""
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): number | undefined {
  if (!value) return undefined
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

/**
 * Start / end (event banners and profile decorations), written to the
 * draft only when the order is valid. Times are the seller's local time,
 * stored as UTC (schedule.ts rules).
 */
export function ScheduleFields({
  schedule,
  disabled,
  now,
  onCommit,
}: {
  schedule: Schedule
  disabled: boolean
  now: number
  onCommit: (dates: { startsAt?: number; endsAt?: number }) => void
}) {
  const t = useTranslations("EventBanners.schedule")
  const id = useId()
  const [mode, setMode] = useState<"always" | "dates">(schedule.startsAt !== undefined || schedule.endsAt !== undefined ? "dates" : "always")
  const [start, setStart] = useState(toLocalInput(schedule.startsAt))
  const [end, setEnd] = useState(toLocalInput(schedule.endsAt))
  const dates = mode === "always" ? {} : { startsAt: fromLocalInput(start), endsAt: fromLocalInput(end) }
  const problem = scheduleProblem(dates, now)
  const ended = problem === null && dates.endsAt !== undefined && dates.endsAt <= now

  function commit(nextMode: "always" | "dates", nextStart: string, nextEnd: string) {
    const next = nextMode === "always" ? {} : { startsAt: fromLocalInput(nextStart), endsAt: fromLocalInput(nextEnd) }
    if (scheduleProblem(next, now) !== "order") onCommit(next)
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
          { value: "always", label: t("always") },
          { value: "dates", label: t("dates") },
        ]}
      />
      {mode === "dates" ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["start", start, setStart, t("start"), t("startHelp")],
                ["end", end, setEnd, t("end"), t("endHelp")],
              ] as const
            ).map(([key, value, set, label, help]) => (
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
                    if (key === "start") commit("dates", e.target.value, end)
                    else commit("dates", start, e.target.value)
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
            {problem === "order"
              ? t("order")
              : problem === "tooFar"
                ? t("tooFar")
                : problem === "tooLong"
                  ? t("tooLong", { days: PROMO_MAX_DAYS })
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
