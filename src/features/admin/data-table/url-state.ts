import { addDays, dayStartMs, isDay } from "../../../../convex/lib/days"

/**
 * Admin lists keep their filters, search, page, page size, sort and open
 * row in the address (CLAUDE.md "UI"), so a refresh, a shared link, a
 * notification or a "Needs attention" card opens the same view. Pure:
 * parsing never trusts the URL (unknown or invalid values fall back to
 * the defaults) and serializing leaves defaults out.
 */
export type ParamSource = { get(name: string): string | null }

export type SortOrder = "asc" | "desc"

export type FilterSpec =
  | {
      kind: "select"
      key: string
      /** Allowed values. Omit for ids loaded at run time (any safe id is accepted, the server checks it). */
      options?: readonly string[]
      /** Used when the URL has no value. "" = all. A non-empty default writes `key=all` for "all". */
      default?: string
    }
  | { kind: "checkbox"; key: string }
  | { kind: "dateRange"; fromKey: string; toKey: string }

export type TableSpec = {
  filters: readonly FilterSpec[]
  /** Default direction of the sortable (date) column; omit when the list can't be sorted. */
  order?: SortOrder
  pageSizes?: readonly number[]
}

/** Every filter value is a string: a select's value, "1" for a ticked checkbox, "YYYY-MM-DD" for a day, or "". */
export type FilterValues = Record<string, string>

export type TableUrlState = {
  search: string
  filters: FilterValues
  page: number
  size: number
  order: SortOrder
  open: string | null
}

export const PAGE_SIZES = [20, 50, 100] as const
export const ALL = "all"
const SEARCH_MAX = 100
const PAGE_MAX = 500
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

export function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | "" {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : ""
}

export function dayParam(value: string | null): string {
  return value !== null && isDay(value) ? value : ""
}

export function searchParam(value: string | null): string {
  return (value ?? "").trim().slice(0, SEARCH_MAX)
}

/** The picked days as a [from, to) range in ms (UTC); "to" covers the whole day. */
export function dayRange(value: { from: string; to: string }): { from?: number; to?: number } {
  return {
    from: isDay(value.from) ? dayStartMs(value.from) : undefined,
    to: isDay(value.to) ? dayStartMs(addDays(value.to, 1)) : undefined,
  }
}

function sizesOf(spec: TableSpec): readonly number[] {
  return spec.pageSizes ?? PAGE_SIZES
}

/** The filters with nothing picked (the page's defaults). */
export function defaultFilters(spec: TableSpec): FilterValues {
  const values: FilterValues = {}
  for (const f of spec.filters) {
    if (f.kind === "dateRange") {
      values[f.fromKey] = ""
      values[f.toKey] = ""
    } else {
      values[f.key] = f.kind === "select" ? (f.default ?? "") : ""
    }
  }
  return values
}

function selectValue(f: Extract<FilterSpec, { kind: "select" }>, raw: string | null): string {
  const fallback = f.default ?? ""
  if (raw === null || raw === "") return fallback
  if (raw === ALL) return ""
  if (f.options) return (f.options as readonly string[]).includes(raw) ? raw : fallback
  return SAFE_ID.test(raw) ? raw : fallback
}

export function parseTableState(params: ParamSource, spec: TableSpec): TableUrlState {
  const filters: FilterValues = {}
  for (const f of spec.filters) {
    if (f.kind === "select") filters[f.key] = selectValue(f, params.get(f.key))
    else if (f.kind === "checkbox") filters[f.key] = params.get(f.key) === "1" ? "1" : ""
    else {
      filters[f.fromKey] = dayParam(params.get(f.fromKey))
      filters[f.toKey] = dayParam(params.get(f.toKey))
    }
  }
  const sizes = sizesOf(spec)
  const size = Number(params.get("size"))
  const page = Number(params.get("page"))
  const order = params.get("order")
  const open = params.get("open")
  return {
    search: searchParam(params.get("search")),
    filters,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, PAGE_MAX) : 1,
    size: sizes.includes(size) ? size : sizes[0],
    order: order === "asc" || order === "desc" ? order : (spec.order ?? "desc"),
    open: open !== null && SAFE_ID.test(open) ? open : null,
  }
}

/** The query string for a state; defaults are left out so links stay short. */
export function serializeTableState(state: TableUrlState, spec: TableSpec): URLSearchParams {
  const out = new URLSearchParams()
  const search = searchParam(state.search)
  if (search) out.set("search", search)
  for (const f of spec.filters) {
    if (f.kind === "select") {
      const value = state.filters[f.key] ?? ""
      const fallback = f.default ?? ""
      if (value !== fallback) out.set(f.key, value === "" ? ALL : value)
    } else if (f.kind === "checkbox") {
      if (state.filters[f.key] === "1") out.set(f.key, "1")
    } else {
      for (const key of [f.fromKey, f.toKey]) {
        const day = dayParam(state.filters[key] ?? null)
        if (day) out.set(key, day)
      }
    }
  }
  if (spec.order && state.order !== spec.order) out.set("order", state.order)
  if (state.size !== sizesOf(spec)[0]) out.set("size", String(state.size))
  if (state.page > 1) out.set("page", String(state.page))
  if (state.open) out.set("open", state.open)
  return out
}

/** How many filters differ from the defaults (a date range counts once). Search is not a filter. */
export function activeFilterCount(filters: FilterValues, spec: TableSpec): number {
  const defaults = defaultFilters(spec)
  return spec.filters.filter((f) =>
    f.kind === "dateRange"
      ? (filters[f.fromKey] ?? "") !== "" || (filters[f.toKey] ?? "") !== ""
      : (filters[f.key] ?? "") !== defaults[f.key],
  ).length
}

/**
 * The page numbers to show: first, last, and the pages around the current
 * one, with null for a gap. `open` = more pages may exist past `known`.
 */
export function pageWindow(current: number, known: number, open: boolean): (number | null)[] {
  const last = Math.max(known, current, 1)
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last))
  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | null)[] = []
  for (const p of sorted) {
    const prev = out[out.length - 1]
    if (typeof prev === "number" && p - prev > 1) out.push(null)
    out.push(p)
  }
  if (open) out.push(null)
  return out
}
