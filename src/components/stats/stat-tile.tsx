import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "cn"

/**
 * One number with its label, inside a `<dl>` (Stats, the Sales page
 * totals, Reports). `muted` sits inside a card; `card` stands on the page.
 * `extra` goes under the value (e.g. the change versus last month).
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  extra,
  tone = "muted",
  className,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
  extra?: ReactNode
  tone?: "muted" | "card"
  className?: string
}) {
  return (
    <div
      className={cn(
        "print-avoid-break flex min-w-0 flex-col gap-1.5 rounded-lg p-3 sm:p-4",
        tone === "muted" ? "bg-muted/60" : "border bg-card",
        className,
      )}
    >
      <dt className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
        <span className="leading-snug break-words">{label}</span>
      </dt>
      <dd className="truncate font-heading text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</dd>
      {extra ? <dd className="text-xs">{extra}</dd> : null}
    </div>
  )
}
