import type { ReactNode } from "react"
import { cn } from "cn"

/** Small white card that floats around the hero phone (decorative copy). */
export function FloatingCard({ icon, title, body, className }: { icon: ReactNode; title: string; body: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl bg-card p-2.5 pr-4 shadow-lift ring-1 ring-foreground/5 md:gap-3 md:p-3 md:pr-5",
        className,
      )}
    >
      {icon}
      <div className="min-w-0 leading-tight">
        <p className="text-xs font-bold md:text-sm">{title}</p>
        <div className="truncate text-[11px] text-muted-foreground md:text-xs">{body}</div>
      </div>
    </div>
  )
}
