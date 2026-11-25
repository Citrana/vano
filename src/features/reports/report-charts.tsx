"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { cn } from "cn"
import type { DayBar } from "../../../convex/lib/salesRecords/report"

/**
 * Report charts (CLAUDE.md "Sales tracking"): one hue (`--chart`, checked
 * for 3:1 on cards), thin bars with 4px rounded ends on the baseline and
 * a 2px gap, a recessive grid, a hover / tap readout, and a hidden table
 * with the same numbers for screen readers. Bars grow only when motion is
 * welcome (`motion-safe:`).
 */

const dayDate = (day: string) => new Date(`${day}T12:00:00Z`)

/** Revenue per day of the month (the readout also gives the number of sales). */
export function DayBars({ days, money, caption }: { days: readonly DayBar[]; money: (minor: number) => string; caption: string }) {
  const t = useTranslations("Reports.byDay")
  const format = useFormatter()
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(...days.map((d) => d.revenue), 0)
  const date = (day: string) => format.dateTime(dayDate(day), { day: "numeric", month: "short", timeZone: "UTC" })
  const shown = active === null ? null : days[active]
  const last = days.length

  return (
    <figure className="flex flex-col gap-2">
      {/* The readout: the hovered / tapped day, else the best day. */}
      <p className="min-h-5 text-xs text-muted-foreground tabular-nums" aria-hidden>
        {shown ? t("bar", { date: date(shown.day), revenue: money(shown.revenue), sales: shown.sales }) : max > 0 ? money(max) : ""}
      </p>
      <div aria-hidden className="relative h-36 sm:h-44" onPointerLeave={() => setActive(null)}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-border-strong">
          {days.map((d, i) => {
            const height = max === 0 ? 0 : Math.max((d.revenue / max) * 100, d.revenue > 0 ? 2 : 0)
            return (
              <div
                key={d.day}
                className="flex h-full min-w-0 flex-1 items-end"
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              >
                <div
                  className={cn(
                    "w-full rounded-t-[4px] bg-chart motion-safe:transition-[height] motion-safe:duration-300",
                    active !== null && active !== i && "opacity-50",
                  )}
                  style={{ height: `${height}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div aria-hidden className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{date(days[0]?.day ?? "")}</span>
        <span>{date(days[Math.floor(last / 2)]?.day ?? "")}</span>
        <span>{date(days[last - 1]?.day ?? "")}</span>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t("day")}</th>
            <th scope="col">{t("revenue")}</th>
            <th scope="col">{t("sales")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{date(d.day)}</th>
              <td>{money(d.revenue)}</td>
              <td>{d.sales}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Horizontal bars (by source, by category): the label and numbers are text; the bar is extra. */
export function GroupBars({
  rows,
  label,
  money,
}: {
  rows: readonly { key: string; revenue: number; sales: number }[]
  label: (key: string) => string
  money: (minor: number) => string
}) {
  const t = useTranslations("Reports")
  const max = Math.max(...rows.map((r) => r.revenue), 0)
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{label(r.key)}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {t("rowLine", { sales: r.sales, revenue: money(r.revenue) })}
            </span>
          </div>
          <div aria-hidden className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-chart motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${max === 0 ? 0 : Math.max((r.revenue / max) * 100, r.revenue > 0 ? 2 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
