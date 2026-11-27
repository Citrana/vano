import type { Language } from "./catalog";
import type { PaidPlanId, PlanChangeStatus, PlanId } from "./plans";
import { effectivePlan, quotePurchase, stateAt, type PlanPrices, type SubscriptionState } from "./subscriptions";

/**
 * Plan emails (CLAUDE.md "Emails", docs/payments.md section 15): the
 * receipt after a confirmed payment and the confirmation of a downgrade the
 * seller chose. Pure rules only; the senders live in convex/emails/planEmails.ts.
 */

/** Billing dates in emails are shown in Nairobi time, whatever the shop's zone. */
export const BILLING_TIME_ZONE = "Africa/Nairobi";

export function formatBillingDate(ms: number, language: Language): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: BILLING_TIME_ZONE }).format(ms);
}

export type ReceiptKind = {
  kind: "upgrade" | "renewal";
  /** kept: trial → same plan (paid days start at the trial end). ended: trial → higher plan. */
  trial: "kept" | "ended" | null;
};

/**
 * What a confirmed payment did, from the state just before it was applied
 * (`quotePurchase`, the same rule `applyPurchase` uses). A payment that
 * landed as a "downgrade" (the shop moved up while it was pending) extended
 * the current plan, so it reads as a renewal.
 */
export function receiptKind(
  previous: SubscriptionState,
  plan: PaidPlanId,
  now: number,
  prices: PlanPrices,
): ReceiptKind {
  const state = stateAt(previous, now);
  const quote = quotePurchase(state, plan, now, prices);
  const trialing = state.status === "trialing";
  if (quote.kind === "upgrade") return { kind: "upgrade", trial: trialing ? "ended" : null };
  if (quote.kind === "renew") return { kind: "renewal", trial: trialing ? "kept" : null };
  return { kind: "renewal", trial: null };
}

export type ScheduledChange = { status: PlanChangeStatus; toPlan: PlanId; effectiveAt: number };

/**
 * A downgrade the seller chose still counts only while the plan it was
 * chosen on runs to the same end: a payment (new end) or the move to Free
 * closes it without any write. Mutations pass `stateAt(state, now)`;
 * queries pass the stored state (they never read the clock).
 */
export function isPendingChange(change: ScheduledChange, state: SubscriptionState): boolean {
  return (
    change.status === "scheduled" &&
    effectivePlan(state) !== "free" &&
    state.periodEnd !== null &&
    change.effectiveAt === state.periodEnd
  );
}
