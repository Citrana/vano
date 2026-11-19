import { PLAN_IDS, SUBSCRIPTION_STATUSES } from "../../../../convex/lib/plans"
import { PAYMENT_STATUSES } from "../../../../convex/payments/types"
import type { TableSpec } from "../data-table/url-state"

/** /admin/payments URL keys (the failed-payments card and notification use them). Newest first. */
export const PAYMENTS_SPEC = {
  filters: [
    { kind: "select", key: "status", options: PAYMENT_STATUSES },
    { kind: "select", key: "plan", options: PLAN_IDS },
    { kind: "dateRange", fromKey: "from", toKey: "to" },
  ],
  order: "desc",
} as const satisfies TableSpec

/** /admin/subscriptions URL keys; `from`/`to` are the plan's end day (the ending-soon card). Soonest first. */
export const SUBSCRIPTIONS_SPEC = {
  filters: [
    { kind: "select", key: "status", options: SUBSCRIPTION_STATUSES },
    { kind: "select", key: "plan", options: PLAN_IDS },
    { kind: "dateRange", fromKey: "from", toKey: "to" },
  ],
  order: "asc",
} as const satisfies TableSpec
