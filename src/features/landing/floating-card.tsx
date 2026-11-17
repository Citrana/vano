import type { ReactNode } from "react"
import { cn } from "cn"

/** Small white card that floats around the hero phone (decorative copy). */
export function FloatingCard({ icon, title, body, className }: { icon: ReactNode; title: string; body: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-card p-3 pr-4 text-left shadow-lift ring-1 ring-foreground/5 md:pr-5",
        className,
      )}
    >
      {icon}
      <div className="min-w-0 leading-snug">
        <p className="text-sm font-bold md:text-base">{title}</p>
        <div className="truncate text-sm text-muted-foreground">{body}</div>
      </div>
    </div>
  )
}
