"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { shopFiltersToQuery, type ShopFilters } from "./shop-filters"

const SEARCH_DEBOUNCE_MS = 400

/**
 * The shop page's filters, kept in the page link (CLAUDE.md "Public
 * pages") so a filtered view can be shared. The page parses the link on
 * the server (`initial`); every change rewrites it with
 * `history.replaceState` (no new history entry, no server round trip;
 * Next keeps `useSearchParams` in sync). Typing in the search box writes
 * the link after a short pause; the list itself updates at once.
 */
export function useShopFilters(initial: ShopFilters, { syncUrl }: { syncUrl: boolean }) {
  const [filters, setFilters] = useState(initial)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!syncUrl) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    const write = () => {
      const { pathname, hash } = window.location
      const next = `${pathname}${shopFiltersToQuery(filters)}${hash}`
      if (next !== `${pathname}${window.location.search}${hash}`) window.history.replaceState(window.history.state, "", next)
    }
    timer.current = window.setTimeout(write, SEARCH_DEBOUNCE_MS)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [filters, syncUrl])

  const update = useCallback((patch: Partial<ShopFilters>) => setFilters((current) => ({ ...current, ...patch })), [])
  return { filters, update, replace: setFilters }
}
