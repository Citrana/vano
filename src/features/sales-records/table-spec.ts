import { SALE_SOURCES } from "../../../convex/lib/salesRecords/validators"
import type { TableSpec } from "../../components/data-table/url-state"

export const RECORD_STATUSES = ["recorded", "reversed"] as const

/**
 * /dashboard/sales URL keys (the shared list, CLAUDE.md "UI"): days in
 * the shop's time zone, source, status, product (an id loaded at run
 * time). Newest first. The product page links here with `from`, `to`
 * and `open`.
 */
export const SALES_SPEC = {
  filters: [
    { kind: "dateRange", fromKey: "from", toKey: "to" },
    { kind: "select", key: "source", options: SALE_SOURCES },
    { kind: "select", key: "status", options: RECORD_STATUSES },
    { kind: "select", key: "product" },
  ],
  order: "desc",
} as const satisfies TableSpec

/** A link to one sale on the Sales page, its day selected. */
export function saleHref(sale: { _id: string; day: string }): string {
  return `/dashboard/sales?from=${sale.day}&to=${sale.day}&open=${sale._id}`
}
