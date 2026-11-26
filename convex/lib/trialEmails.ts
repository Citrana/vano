import { v, type Infer } from "convex/values";
import { DAY_MS, TRIAL_PLAN, daysLeft } from "./plans";
import type { SubscriptionState } from "./subscriptions";

/**
 * Trial reminder emails (CLAUDE.md "Emails"). Pure rules, used by the
 * daily job that plans the sends and again by each send, against the
 * subscription as it is at that moment (convex/trialEmailJobs.ts).
 *
 * - days7: the trial ends in 3–7 days (normally exactly 7);
 * - days2: it ends in 1–2 days (a 7-day email not sent by then is dropped);
 * - ended: the shop moved to Free from the trial (`trialEndedAt`) in the
 *   last `ENDED_EMAIL_WINDOW_DAYS` days.
 *
 * Each email goes once per (shop, kind, trial end): `periodEnd` for the
 * countdown, `trialEndedAt` for "ended". When the trial's end date
 * changes, the countdown follows the new date.
 */

export const TRIAL_EMAIL_KINDS = ["days7", "days2", "ended"] as const;
export const trialEmailKindValidator = v.union(v.literal("days7"), v.literal("days2"), v.literal("ended"));
export type TrialEmailKind = Infer<typeof trialEmailKindValidator>;

/** Reminders per UTC day, below Resend's free 100 (auth codes and welcome emails need the rest). */
export const TRIAL_EMAILS_PER_DAY = 70;
/** Gap between two scheduled reminders (70 → about 70 minutes). */
export const TRIAL_EMAIL_SPACING_MS = 60_000;
/** The "You're now on Free" email isn't sent later than this after the switch. */
export const ENDED_EMAIL_WINDOW_DAYS = 7;
export const FIRST_REMINDER_DAYS = 7;
export const LAST_REMINDER_DAYS = 2;

/** Most urgent first when the daily budget runs out. */
export const KIND_PRIORITY: readonly TrialEmailKind[] = ["days2", "ended", "days7"];

export type DueTrialEmail = { kind: TrialEmailKind; trialEnd: number };
/** What was already sent to this shop. */
export type SentTrialEmail = { kind: TrialEmailKind; trialEnd: number };

const wasSent = (sent: readonly SentTrialEmail[], kind: TrialEmailKind, trialEnd: number) =>
  sent.some((s) => s.kind === kind && s.trialEnd === trialEnd);

export function dueTrialEmail(
  state: SubscriptionState,
  sent: readonly SentTrialEmail[],
  now: number,
): DueTrialEmail | null {
  if (state.status === "trialing" && state.plan === TRIAL_PLAN && state.periodEnd !== null && state.periodEnd > now) {
    const end = state.periodEnd;
    const left = daysLeft(end, now);
    if (wasSent(sent, "days2", end)) return null;
    if (left <= LAST_REMINDER_DAYS) return { kind: "days2", trialEnd: end };
    if (left <= FIRST_REMINDER_DAYS && !wasSent(sent, "days7", end)) return { kind: "days7", trialEnd: end };
    return null;
  }
  const endedAt = state.trialEndedAt ?? null;
  if (state.status === "free" && endedAt !== null && endedAt <= now && now - endedAt <= ENDED_EMAIL_WINDOW_DAYS * DAY_MS) {
    // One trial per shop: "ended" never repeats, whatever the date.
    return sent.some((s) => s.kind === "ended") ? null : { kind: "ended", trialEnd: endedAt };
  }
  return null;
}

export function sameDue(a: DueTrialEmail | null, b: DueTrialEmail): boolean {
  return a !== null && a.kind === b.kind && a.trialEnd === b.trialEnd;
}

/** Most urgent kind first, then the nearest (oldest) date. */
export function byPriority<C extends DueTrialEmail>(candidates: readonly C[]): C[] {
  return [...candidates].sort(
    (a, b) => KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind) || a.trialEnd - b.trialEnd,
  );
}
