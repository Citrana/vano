import type { PromoFacet, StoredLook } from "./validators";

/**
 * When an event & promo banner (or a profile decoration) shows (CLAUDE.md
 * "Shop looks"). Pure; the editor and `shopLooks.publish` use the same
 * rules for both. Times are UTC ms; a missing start = from publish, a
 * missing end = until removed.
 *
 * Queries never read the clock: whether the published promo / decoration
 * is live is stored on the `shopLooks` row (`promoLive`, `decorationLive`)
 * and kept current by `shopLookJobs.syncSchedules`, scheduled at the start
 * and end.
 */

export const PROMO_MAX_DAYS = 92;
export const PROMO_MAX_LEAD_DAYS = 365;
const DAY_MS = 86_400_000;

type Schedule = Pick<PromoFacet, "startsAt" | "endsAt">;

export function promoLiveAt(promo: Schedule | undefined | null, now: number): boolean {
  if (!promo) return false;
  if (promo.startsAt !== undefined && now < promo.startsAt) return false;
  if (promo.endsAt !== undefined && now >= promo.endsAt) return false;
  return true;
}

export type PromoStatus = "live" | "scheduled" | "ended";

export function promoStatusAt(promo: Schedule, now: number): PromoStatus {
  if (promo.endsAt !== undefined && now >= promo.endsAt) return "ended";
  if (promo.startsAt !== undefined && now < promo.startsAt) return "scheduled";
  return "live";
}

/** Shape problems: refused when saving a draft too. */
export function scheduleShapeProblem(promo: Schedule): "order" | null {
  for (const t of [promo.startsAt, promo.endsAt]) {
    if (t !== undefined && (!Number.isInteger(t) || t < 0)) return "order";
  }
  if (promo.startsAt !== undefined && promo.endsAt !== undefined && promo.endsAt <= promo.startsAt) return "order";
  return null;
}

/**
 * Refused at publish. An end in the past is NOT refused: an ended promo
 * stays saved (it just isn't live), so other look changes can still go live.
 */
export function scheduleProblem(promo: Schedule, now: number): "order" | "tooFar" | "tooLong" | null {
  const shape = scheduleShapeProblem(promo);
  if (shape) return shape;
  if (promo.startsAt !== undefined && promo.startsAt > now + PROMO_MAX_LEAD_DAYS * DAY_MS) return "tooFar";
  if (promo.endsAt !== undefined && promo.endsAt > now) {
    const from = Math.max(promo.startsAt ?? now, now);
    if (promo.endsAt - from > PROMO_MAX_DAYS * DAY_MS) return "tooLong";
  }
  return null;
}

/** Whether a published look's promo and profile decoration are live at `now`. */
export function liveFlags(published: StoredLook | undefined | null, now: number): { promoLive: boolean; decorationLive: boolean } {
  return {
    promoLive: promoLiveAt(published?.overrides.promo, now),
    decorationLive: promoLiveAt(published?.overrides.profile?.decoration, now),
  };
}

/** Future start / end times to schedule a `syncSchedules` job at. */
export function promoBoundaries(promo: Schedule | undefined | null, now: number): number[] {
  if (!promo) return [];
  return [promo.startsAt, promo.endsAt].filter((t): t is number => t !== undefined && t > now);
}
