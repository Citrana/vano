import { addDays, utcDay } from "../../../convex/lib/days"
import { localDay } from "../../../convex/lib/timeZone"

export type DatePreset = { key: "last7" | "last30" | "thisMonth"; from: string; to: string }

/**
 * Today and the quick ranges of the date filter, as "YYYY-MM-DD" days:
 * in UTC (admin lists) or in a given time zone (a shop's recorded
 * sales). Pure.
 */
export function datePresets(now: number, timeZone?: string): { today: string; presets: DatePreset[] } {
  const today = timeZone ? localDay(now, timeZone) : utcDay(now)
  return {
    today,
    presets: [
      { key: "last7", from: addDays(today, -6), to: today },
      { key: "last30", from: addDays(today, -29), to: today },
      { key: "thisMonth", from: `${today.slice(0, 8)}01`, to: today },
    ],
  }
}
