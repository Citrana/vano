import { scheduleProblem } from "../looks/schedule";
import type { SaleDisplay } from "./validators";

/**
 * Limits and schedule rules for sales (CLAUDE.md "Sales"). Pure; the
 * sale editor and `convex/sales.ts` use the same ones. Dates follow the
 * event banner rules (`convex/lib/looks/schedule.ts`: `PROMO_MAX_DAYS`,
 * `PROMO_MAX_LEAD_DAYS`), entered in the seller's time zone and stored
 * as UTC ms.
 */

export const SALE_NAME_MIN = 2;
export const SALE_NAME_MAX = 60;
/** Saved sales per shop (running, scheduled, paused and ended). */
export const SALES_MAX = 50;
/** "Ending soon" notification, this long before the end. */
export const ENDING_SOON_MS = 86_400_000;

export function saleNameProblem(name: string): "length" | null {
  const n = name.trim().length;
  return n >= SALE_NAME_MIN && n <= SALE_NAME_MAX ? null : "length";
}

export type SaleScheduleProblem = "order" | "tooFar" | "tooLong" | "ended";

/**
 * Refused when saving: the event banner rules, plus the end must be in
 * the future (a sale always has an end, for the countdown).
 */
export function saleScheduleProblem(
  schedule: { startsAt?: number; endsAt: number },
  now: number,
): SaleScheduleProblem | null {
  const problem = scheduleProblem(schedule, now);
  if (problem) return problem;
  if (!Number.isInteger(schedule.endsAt) || schedule.endsAt <= now) return "ended";
  return null;
}

export const SALE_PRESETS = ["flash", "weekend", "blackFriday", "clearance"] as const;
export type SalePreset = (typeof SALE_PRESETS)[number];

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Local midnight of `ms` plus `days` (uses the runtime's time zone). */
function localMidnight(ms: number, days = 0): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** The 4th Friday of November (Black Friday) of `year`, local midnight. */
export function blackFridayOf(year: number): number {
  const first = new Date(year, 10, 1).getDay();
  const firstFriday = 1 + ((5 - first + 7) % 7);
  return new Date(year, 10, firstFriday + 21).getTime();
}

/**
 * What a quick-start preset fills in: dates (in the browser's time zone)
 * and display options. `startsAt` undefined = start now. The editor adds
 * the translated name; the seller can change everything.
 */
export function presetValues(
  preset: SalePreset,
  now: number,
): { startsAt?: number; endsAt: number; display: SaleDisplay } {
  switch (preset) {
    case "flash":
      return { endsAt: now + DAY_MS, display: { countdown: true, badge: true, label: false } };
    case "weekend": {
      const day = new Date(now).getDay();
      // Saturday 00:00 → Monday 00:00; already the weekend → from now.
      const saturday = localMidnight(now, (6 - day + 7) % 7);
      const monday = localMidnight(now, day === 0 ? 1 : ((8 - day) % 7) || 7);
      return {
        startsAt: day === 6 || day === 0 ? undefined : saturday,
        endsAt: monday,
        display: { countdown: true, badge: true, label: true },
      };
    }
    case "blackFriday": {
      const year = new Date(now).getFullYear();
      let start = blackFridayOf(year);
      // Black Friday to the end of Cyber Monday (Tuesday 00:00).
      let end = localMidnight(start, 4);
      if (now >= end) {
        start = blackFridayOf(year + 1);
        end = localMidnight(start, 4);
      }
      return {
        startsAt: now >= start ? undefined : start,
        endsAt: end,
        display: { countdown: true, badge: true, label: true },
      };
    }
    case "clearance":
      return { endsAt: localMidnight(now, 15), display: { countdown: false, badge: true, label: true } };
  }
}
