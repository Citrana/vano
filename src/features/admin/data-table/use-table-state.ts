"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import {
  activeFilterCount,
  defaultFilters,
  parseTableState,
  serializeTableState,
  type FilterValues,
  type SortOrder,
  type TableSpec,
  type TableUrlState,
} from "./url-state"

export type TableState = TableUrlState & {
  spec: TableSpec
  /** At least one filter differs from the defaults, or a search is typed. */
  filtered: boolean
  activeFilters: number
  setSearch: (search: string) => void
  setFilters: (patch: FilterValues) => void
  clearFilters: () => void
  setPage: (page: number) => void
  setSize: (size: number) => void
  setOrder: (order: SortOrder) => void
  open: string | null
  openRow: (id: string) => void
  closeRow: () => void
}

/**
 * A list's state lives in the address (CLAUDE.md "UI"). Writes use
 * `history.replaceState`, which Next keeps in sync with useSearchParams
 * without a server round trip. Any change but the page / open row goes
 * back to page 1. Pass a stable `spec` (module constant or useMemo).
 */
export function useTableState(spec: TableSpec): TableState {
  const params = useSearchParams()
  const pathname = usePathname()
  const state = useMemo(() => parseTableState(params, spec), [params, spec])

  const write = useCallback(
    (update: (current: TableUrlState) => TableUrlState) => {
      // Read the live URL, not the last render, so quick writes don't undo each other.
      const current = parseTableState(new URLSearchParams(window.location.search), spec)
      const query = serializeTableState(update(current), spec).toString()
      window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname)
    },
    [pathname, spec],
  )

  const activeFilters = activeFilterCount(state.filters, spec)
  return {
    ...state,
    spec,
    activeFilters,
    filtered: activeFilters > 0 || state.search !== "",
    setSearch: useCallback((search) => write((s) => ({ ...s, search, page: 1 })), [write]),
    setFilters: useCallback((patch) => write((s) => ({ ...s, filters: { ...s.filters, ...patch }, page: 1 })), [write]),
    clearFilters: useCallback(() => write((s) => ({ ...s, search: "", filters: defaultFilters(spec), page: 1 })), [write, spec]),
    setPage: useCallback((page) => write((s) => ({ ...s, page })), [write]),
    setSize: useCallback((size) => write((s) => ({ ...s, size, page: 1 })), [write]),
    setOrder: useCallback((order) => write((s) => ({ ...s, order, page: 1 })), [write]),
    openRow: useCallback((id) => write((s) => ({ ...s, open: id })), [write]),
    closeRow: useCallback(() => write((s) => ({ ...s, open: null })), [write]),
  }
}

/** Closes the details drawer from inside it (e.g. after deleting its record), keeping the list's filters. */
export function closeDetailsDrawer() {
  const url = new URL(window.location.href)
  url.searchParams.delete("open")
  window.history.replaceState(window.history.state, "", url)
}
