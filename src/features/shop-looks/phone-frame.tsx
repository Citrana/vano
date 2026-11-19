import type { ReactNode } from "react"
import { cn } from "cn"

/**
 * A CSS phone frame (Home hero, the "Shop look" editor preview). The
 * screen clips its content; callers draw the shop at 375px and zoom it.
 */
export function PhoneFrame({
  label,
  className,
  children,
}: {
  /** Accessible description when the content is inert. */
  label?: string
  className?: string
  children: ReactNode
}) {
  return (
    <figure
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn("relative rounded-[2.5rem] bg-ink p-2 text-left shadow-float", className)}
    >
      <div className="relative aspect-[9/19] overflow-hidden rounded-[2rem]">{children}</div>
    </figure>
  )
}
