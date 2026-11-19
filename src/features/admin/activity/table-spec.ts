import { AUDIT_ACTIONS } from "../../../../convex/lib/audit"
import type { TableSpec } from "../data-table/url-state"

/** /admin/activity URL keys. `actor` is "system" or a user id (loaded at run time). Newest first. */
export const ACTIVITY_SPEC = {
  filters: [
    { kind: "select", key: "actor" },
    { kind: "select", key: "action", options: AUDIT_ACTIONS },
    { kind: "dateRange", fromKey: "from", toKey: "to" },
  ],
  order: "desc",
} as const satisfies TableSpec
