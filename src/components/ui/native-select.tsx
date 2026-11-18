import * as React from "react"
import { cn } from "cn"

/** A styled native <select>, matching Input (native = best on phones). */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive md:h-9 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
