"use client"

import { useId, type KeyboardEvent, type ReactNode } from "react"
import { cn } from "cn"

/**
 * Arrow-key handling for a custom radiogroup (WAI-ARIA radio pattern):
 * arrows move focus and selection, Home / End jump to the ends.
 */
export function radioKeyDown(event: KeyboardEvent<HTMLElement>, index: number, count: number, select: (index: number) => void) {
  const keys: Record<string, number> = {
    ArrowRight: index + 1,
    ArrowDown: index + 1,
    ArrowLeft: index - 1,
    ArrowUp: index - 1,
    Home: 0,
    End: count - 1,
  }
  if (!(event.key in keys)) return
  event.preventDefault()
  const next = (keys[event.key] + count) % count
  select(next)
  const group = event.currentTarget.closest('[role="radiogroup"]')
  group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
}

export type Choice<T extends string> = { value: T; label: string; icon?: ReactNode }

/** A segmented single choice (radiogroup), 44px targets, keyboard friendly. */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  size = "default",
  wrap = false,
  className,
}: {
  label: string
  value: T
  options: readonly Choice<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  /** "compact": smaller label and 36px options, for desktop toolbars only. */
  size?: "default" | "compact"
  /** Long labels: options wrap to fit their text instead of equal columns. */
  wrap?: boolean
  className?: string
}) {
  const id = useId()
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div className={cn("flex flex-col", size === "compact" ? "gap-1" : "gap-2", className)}>
      <span className={cn("font-medium", size === "compact" ? "text-xs text-muted-foreground" : "text-sm")} id={id}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        aria-disabled={disabled || undefined}
        // Four or more options wrap to two columns on phones so labels fit.
        className={cn(
          "gap-1 rounded-md border bg-card p-1",
          wrap
            ? "flex flex-wrap [&>*]:flex-auto"
            : cn("grid", options.length > 3 ? "grid-cols-2 sm:grid-cols-4" : options.length === 3 ? "grid-cols-3" : "grid-cols-2"),
        )}
      >
        {options.map((option, index) => {
          const selected = index === selectedIndex
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => radioKeyDown(e, index, options.length, (i) => onChange(options[i].value))}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-sm border border-transparent px-2 font-medium transition-colors focus-ring disabled:opacity-50 [&_svg]:size-4",
                size === "compact" ? "min-h-8 text-xs" : "min-h-11 text-sm md:min-h-9",
                selected ? "chip-selected" : "hover:bg-muted",
              )}
            >
              {option.icon}
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
