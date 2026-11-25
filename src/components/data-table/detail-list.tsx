import type { ReactNode } from "react"
import { cn } from "cn"

/** The label / value grid inside a details drawer. */
export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid gap-3 text-sm sm:grid-cols-2", className)}>{children}</dl>
}

export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  )
}
