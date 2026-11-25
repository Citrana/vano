/**
 * Time zones (CLAUDE.md "Sales tracking"): a shop's optional IANA zone
 * (`shops.timeZone`, e.g. "Africa/Kinshasa") and the wall-clock maths on
 * it. Pure: shared by the server (a sale's local `day`) and the browser
 * (`src/lib/local-time.ts` re-uses `wallClock` / `zonedToUtc`).
 */

/** Used while a shop has no zone yet. */
export const DEFAULT_TIME_ZONE = "UTC";

export function timeZoneProblem(zone: string): "invalid" | null {
  if (zone.length === 0 || zone.length > 64) return "invalid";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return null;
  } catch {
    return "invalid";
  }
}

/** The zone a shop's dates use. */
export function shopTimeZone(shop: { timeZone?: string }): string {
  return shop.timeZone && timeZoneProblem(shop.timeZone) === null ? shop.timeZone : DEFAULT_TIME_ZONE;
}

export type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

/** Wall-clock parts of `ms` in `timeZone` (month 1–12). */
export function wallClock(ms: number, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** A wall-clock time in `timeZone` → UTC ms (NaN for impossible input). */
export function zonedToUtc(wall: WallClock, timeZone: string): number {
  // Guess with the wall clock read as UTC, then correct by the zone's
  // offset at that moment (twice, for times next to a DST change).
  const target = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  let ms = target;
  for (let i = 0; i < 2; i++) {
    const p = wallClock(ms, timeZone);
    ms += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return ms;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The calendar day of `ms` in `timeZone`, "YYYY-MM-DD". */
export function localDay(ms: number, timeZone: string): string {
  const p = wallClock(ms, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
