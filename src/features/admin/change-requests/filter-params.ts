import {
  CHANGE_STATUSES,
  PROTECTED_FIELDS,
  type ChangeStatus,
  type ProtectedField,
} from "../../../../convex/lib/changeRequests"
import { dayParam, oneOf, searchParam, type ParamSource } from "../billing/filter-params"

export type ChangeRequestsFilterValue = {
  search: string
  status: "" | ChangeStatus
  field: "" | ProtectedField
  /** "YYYY-MM-DD" (UTC) or "" */
  from: string
  to: string
  /** Only requests flagged for a risky name or link. */
  flagged: boolean
}

/** Pending first: what the admin usually needs. */
export const DEFAULT_FILTERS: ChangeRequestsFilterValue = {
  search: "",
  status: "pending",
  field: "",
  from: "",
  to: "",
  flagged: false,
}

const KEYS = ["search", "status", "field", "from", "to", "flagged"] as const

/**
 * `?status=&field=&flagged=1&search=&from=&to=`. No filter in the URL gives
 * the defaults (pending); any filter in the URL replaces them.
 */
export function changeRequestFiltersFromParams(params: ParamSource): ChangeRequestsFilterValue {
  if (!KEYS.some((k) => params.get(k) !== null)) return DEFAULT_FILTERS
  return {
    search: searchParam(params.get("search")),
    status: oneOf(params.get("status"), CHANGE_STATUSES),
    field: oneOf(params.get("field"), PROTECTED_FIELDS),
    from: dayParam(params.get("from")),
    to: dayParam(params.get("to")),
    flagged: params.get("flagged") === "1",
  }
}
