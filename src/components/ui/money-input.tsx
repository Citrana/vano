"use client"

import * as React from "react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"

/**
 * Price entry in major units ("25" / "25.50") with the currency shown
 * beside it. The form keeps the raw text; its Zod schema converts it with
 * `parseMoneyToMinor` (CLAUDE.md "Money") — never parse money by hand.
 */
function MoneyInput({
  currency,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { currency: string }) {
  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn("pr-16 tabular-nums", className)}
        {...props}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
        {currency}
      </span>
    </div>
  )
}

export { MoneyInput }
