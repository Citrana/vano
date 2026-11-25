import { wallClock, zonedToUtc } from "../../convex/lib/timeZone"

/**
 * Date-time fields in the seller's own time zone (event banners, profile
 * decorations, sales, recorded sales). Stored values are UTC ms; `<input
 * type="datetime-local">` speaks "YYYY-MM-DDTHH:mm" wall-clock time. Pure.
 * `timeZone` defaults to the browser's; the zone maths lives in
 * `convex/lib/timeZone.ts` (shared with the server).
 */

const pad = (n: number) => String(n).padStart(2, "0")

/** UTC ms → "YYYY-MM-DDTHH:mm" in the time zone; "" for undefined. */
export function toLocalInput(ms: number | undefined, timeZone?: string): string {
  if (ms === undefined) return ""
  if (timeZone === undefined) {
    const d = new Date(ms)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const p = wallClock(ms, timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** "YYYY-MM-DDTHH:mm" in the time zone → UTC ms; undefined if empty or invalid. */
export function fromLocalInput(value: string, timeZone?: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return undefined
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  if (timeZone === undefined) {
    const ms = new Date(year, month - 1, day, hour, minute).getTime()
    return Number.isFinite(ms) ? ms : undefined
  }
  const ms = zonedToUtc({ year, month, day, hour, minute }, timeZone)
  return Number.isFinite(ms) ? ms : undefined
}

/** The browser's IANA time zone ("Africa/Kinshasa"), or undefined. */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}
