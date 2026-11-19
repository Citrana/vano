import { CHANGE_STATUSES, PROTECTED_FIELDS } from "../../../../convex/lib/changeRequests"
import type { TableSpec } from "../data-table/url-state"

/** /admin/change-requests URL keys (read by attention cards and notifications). Pending by default. */
export const CHANGE_REQUESTS_SPEC = {
  filters: [
    { kind: "select", key: "status", options: CHANGE_STATUSES, default: "pending" },
    { kind: "select", key: "field", options: PROTECTED_FIELDS },
    { kind: "dateRange", fromKey: "from", toKey: "to" },
    { kind: "checkbox", key: "flagged" },
  ],
  order: "desc",
} as const satisfies TableSpec
