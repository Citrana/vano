"use client"

import {
  usePaginatedQuery,
  type PaginatedQueryArgs,
  type PaginatedQueryItem,
  type PaginatedQueryReference,
} from "convex/react"
import { useEffect } from "react"

export type TablePages<Row> = {
  /** The rows of the current page. */
  rows: Row[]
  /** The first page, or a later page still loading. */
  loading: boolean
  /** Rows loaded so far (the total once `total` is known). */
  loaded: number
  /** Known once the last page has loaded. */
  total: number | null
  pageCount: number | null
}

/**
 * Numbered pages over a Convex paginated query (cursor based, no total):
 * page N loads rows until N × size are in, then shows its slice. The
 * total shows once the end is reached. A page past the end goes back to
 * the last page. Errors are thrown: wrap the caller in `TableBoundary`.
 */
export function useTablePages<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  { page, size, setPage }: { page: number; size: number; setPage: (page: number) => void },
): TablePages<PaginatedQueryItem<Query>> {
  const { results, status, loadMore } = usePaginatedQuery(query, args, { initialNumItems: size })
  const needed = page * size
  const done = status === "Exhausted"

  useEffect(() => {
    if (status === "CanLoadMore" && results.length < needed) loadMore(needed - results.length)
  }, [status, results.length, needed, loadMore])

  const total = done ? results.length : null
  const pageCount = total === null ? null : Math.max(1, Math.ceil(total / size))
  useEffect(() => {
    if (pageCount !== null && page > pageCount) setPage(pageCount)
  }, [page, pageCount, setPage])

  return {
    rows: results.slice((page - 1) * size, needed),
    loading: status === "LoadingFirstPage" || (!done && results.length < needed),
    loaded: results.length,
    total,
    pageCount,
  }
}
