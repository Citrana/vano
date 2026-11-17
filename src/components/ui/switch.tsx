"use client"

import * as React from "react"
import { cn } from "cn"

/** Accessible on/off switch (role="switch"), 44px tap area on phones. */
function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group inline-flex min-h-11 shrink-0 items-center outline-none disabled:opacity-50 md:min-h-8",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </span>
    </button>
  )
}

export { Switch }
