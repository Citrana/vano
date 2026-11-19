import { addDays, utcDay } from "../../../../convex/lib/days"
import { EXPIRY_WARNING_DAYS } from "../../../../convex/lib/plans"
import { FAILED_PAYMENT_WINDOW_DAYS } from "../../../../convex/notifications/config"

export type AttentionCard = "pendingChangeRequests" | "flaggedChangeRequests" | "failedPayments" | "endingSoon"

/** Each attention card opens its list with the matching filters (read by `*FiltersFromParams`). */
export function attentionHref(card: AttentionCard, now: number): string {
  const today = utcDay(now)
  switch (card) {
    case "pendingChangeRequests":
      return "/admin/change-requests?status=pending"
    case "flaggedChangeRequests":
      return "/admin/change-requests?status=pending&flagged=1"
    case "failedPayments":
      return `/admin/payments?${new URLSearchParams({ status: "failed", from: addDays(today, -FAILED_PAYMENT_WINDOW_DAYS) })}`
    case "endingSoon":
      return `/admin/subscriptions?${new URLSearchParams({ from: today, to: addDays(today, EXPIRY_WARNING_DAYS) })}`
  }
}
