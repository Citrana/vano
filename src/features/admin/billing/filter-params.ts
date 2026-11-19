import { isDay } from "../../../../convex/lib/days"
import { PLAN_IDS, type PlanId } from "../../../../convex/lib/plans"

/** Reads filters from the URL (deep links from notifications and attention cards). Pure. */
export type ParamSource = { get(name: string): string | null }

export type BillingFilterValue<S extends string> = {
  search: string
  plan: "" | PlanId
  status: "" | S
  /** "YYYY-MM-DD" (UTC) or "" */
  from: string
  to: string
}

const SEARCH_MAX = 100

export function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | "" {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : ""
}

export function dayParam(value: string | null): string {
  return value !== null && isDay(value) ? value : ""
}

export function searchParam(value: string | null): string {
  return (value ?? "").trim().slice(0, SEARCH_MAX)
}

/** `?search=&plan=&status=&from=&to=`; anything unknown or invalid is ignored. */
export function billingFiltersFromParams<S extends string>(
  params: ParamSource,
  statuses: readonly S[],
): BillingFilterValue<S> {
  return {
    search: searchParam(params.get("search")),
    plan: oneOf(params.get("plan"), PLAN_IDS),
    status: oneOf(params.get("status"), statuses),
    from: dayParam(params.get("from")),
    to: dayParam(params.get("to")),
  }
}
