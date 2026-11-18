import type { ReactNode } from "react"
import { cn } from "cn"

/**
 * Small white card floating around the hero phone (sample copy, not real
 * data). Compact on phones, roomier from lg up. `toast` is a one-line pill.
 */
export function FloatingCard({
  icon,
  title,
  body,
  tone = "default",
  variant = "card",
  className,
}: {
  icon: ReactNode
  title: ReactNode
  body?: ReactNode
  tone?: "default" | "success"
  variant?: "card" | "toast"
  className?: string
}) {
  const toast = variant === "toast"
  return (
    <div
      className={cn(
        "flex items-center bg-card text-left border shadow-float",
        toast
          ? "gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 lg:py-2 lg:pr-4 lg:pl-2"
          : "gap-2.5 rounded-xl p-2.5 pr-3.5 lg:gap-3 lg:p-3 lg:pr-5",
        className,
      )}
    >
      {icon}
      <div className="min-w-0 leading-snug">
        <p className={cn("text-sm font-bold lg:text-base", toast && "whitespace-nowrap lg:text-sm", tone === "success" && "text-whatsapp")}>
          {title}
        </p>
        {body ? <div className="truncate text-sm text-muted-foreground">{body}</div> : null}
      </div>
    </div>
  )
}
