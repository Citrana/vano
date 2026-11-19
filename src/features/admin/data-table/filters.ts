import type { FilterDef, SelectOption } from "./types"
import type { TableSpec } from "./url-state"

/** Labels for one filter of a spec (keyed by its key, or `fromKey` for a date range). */
export type FilterLabel = {
  label: string
  /** The "all" choice of a select ("All statuses"). */
  allLabel?: string
  /** Label of each fixed option. */
  optionLabel?: (value: string) => string
  /** Options loaded at run time (ids), for selects whose spec has no option list. */
  options?: readonly SelectOption[]
}

/**
 * The Filters popover entries for a page's pure spec: the spec (in a plain
 * .ts file, so tests can read the deep links) owns keys, options and
 * defaults; the page only adds translated labels.
 */
export function filterDefs(spec: TableSpec, labels: Record<string, FilterLabel>): FilterDef[] {
  return spec.filters.map((f): FilterDef => {
    if (f.kind === "dateRange") return { ...f, label: labels[f.fromKey].label }
    const l = labels[f.key]
    if (f.kind === "checkbox") return { ...f, label: l.label }
    return {
      kind: "select",
      key: f.key,
      default: f.default,
      label: l.label,
      allLabel: l.allLabel ?? l.label,
      options: l.options ?? (f.options ?? []).map((value) => ({ value, label: l.optionLabel?.(value) ?? value })),
    }
  })
}
