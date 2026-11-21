/**
 * Date-time fields in the seller's own time zone (event banners, profile
 * decorations, sales). Stored values are UTC ms; `<input
 * type="datetime-local">` speaks "YYYY-MM-DDTHH:mm" wall-clock time. Pure.
 * `timeZone` defaults to the browser's; tests pass one explicitly.
 */

const pad = (n: number) => String(n).padStart(2, "0")

/** Wall-clock parts of `ms` in `timeZone`. */
function partsIn(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") }
}

/** UTC ms → "YYYY-MM-DDTHH:mm" in the time zone; "" for undefined. */
export function toLocalInput(ms: number | undefined, timeZone?: string): string {
  if (ms === undefined) return ""
  if (timeZone === undefined) {
    const d = new Date(ms)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const p = partsIn(ms, timeZone)
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
  // Guess with the wall clock read as UTC, then correct by the zone's
  // offset at that moment (twice, for times next to a DST change).
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  let ms = wall
  for (let i = 0; i < 2; i++) {
    const p = partsIn(ms, timeZone)
    ms += wall - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  }
  return Number.isFinite(ms) ? ms : undefined
}
