import { cn } from "cn"

/**
 * A small plum count (bell, admin sidebar). Hidden at zero. The number is
 * decorative: pair it with a screen-reader label where it's used.
 */
export function CountBadge({
  count,
  capped = false,
  max = 99,
  className,
}: {
  count: number
  capped?: boolean
  max?: number
  className?: string
}) {
  if (count <= 0) return null
  const label = capped || count > max ? `${max}+` : String(count)
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-plum px-1.5 text-[0.7rem] leading-none font-bold text-white tabular-nums",
        className,
      )}
    >
      {label}
    </span>
  )
}

/** "99+" style text for labels. */
export function countLabel(count: number, capped = false, max = 99): string {
  return capped || count > max ? `${max}+` : String(count)
}
