import type { ReactNode } from "react"

/** One column of an admin list. Pages only describe columns; DataTable owns the look. */
export type Column<Row> = {
  id: string
  header: string
  cell: (row: Row) => ReactNode
  /** The date column: sorted on the server through the list's `order` arg. */
  sortable?: boolean
  align?: "start" | "end"
  /** Tailwind width / max-width classes for the cell, e.g. "w-40" or "max-w-56". */
  className?: string
  /** Muted text (e.g. "Old value"). */
  muted?: boolean
  /** Hidden on narrower desktops; still in the drawer. */
  hideBelow?: "lg" | "xl"
  /** Where this column shows on phones; columns without it only show in the drawer. */
  mobile?: "title" | "subtitle" | "meta" | "trailing"
  /** Only on phones (e.g. "old → new" on one line); left out of the table. */
  mobileOnly?: boolean
  /** Accessible header for icon-only columns (the visible header is empty). */
  srOnlyHeader?: boolean
}

export type SelectOption = { value: string; label: string }

/** A filter in the Filters popover; `key`s are also the URL keys. */
export type FilterDef =
  | {
      kind: "select"
      key: string
      label: string
      options: readonly SelectOption[]
      /** Label of the "all" choice ("All statuses"). */
      allLabel: string
      default?: string
    }
  | { kind: "checkbox"; key: string; label: string }
  | { kind: "dateRange"; fromKey: string; toKey: string; label: string }
