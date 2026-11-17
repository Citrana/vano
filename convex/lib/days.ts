/**
 * Stats days are UTC calendar days, "YYYY-MM-DD" (CLAUDE.md "Stats").
 * Mutations read the clock; queries take `today` as an argument (Convex
 * queries must not read the wall clock).
 */

const DAY_MS = 86_400_000;

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return utcDay(Date.parse(`${value}T00:00:00Z`)) === value;
}

/** addDays("2026-03-01", -1) → "2026-02-28". */
export function addDays(day: string, delta: number): string {
  return utcDay(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS);
}
