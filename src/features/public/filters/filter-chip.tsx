"use client"

import type { ReactNode } from "react"
import { cn } from "cn"

/**
 * A small filter chip: a 32px pill (the look's chip style) inside a 44px
 * tap target. Selected chips use `chip-selected`.
 */
export function FilterChip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn("group flex min-h-11 shrink-0 items-center rounded-sm focus-ring", className)}
    >
      <span
        className={cn(
          "shop-chip flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
          selected ? "chip-selected" : "bg-card group-hover:bg-muted",
        )}
      >
        {children}
      </span>
    </button>
  )
}
