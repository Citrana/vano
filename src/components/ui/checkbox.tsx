"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"
import { cn } from "cn"

/** A 18px checkbox (base-ui), ink when checked. Wrap it in a <label> for a 44px tap target. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "focus-ring peer inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border border-border-strong bg-card transition-colors data-checked:chip-selected data-indeterminate:chip-selected data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-current [&_svg]:size-3.5"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>{state.indeterminate ? <MinusIcon aria-hidden /> : <CheckIcon aria-hidden />}</span>
        )}
      />
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
