"use client"

import { useEffect, useState } from "react"

/**
 * Demo notification count on the hero WhatsApp card: ticks up every 4s
 * (in step with the card's pulse), then starts again. Static when the
 * visitor prefers reduced motion. Decorative, so hidden from screen readers.
 */
export function OrderBadge({ start = 3, max = 9 }: { start?: number; max?: number }) {
  const [count, setCount] = useState(start)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setCount((n) => (n >= max ? start : n + 1))
    }, 4000)
    return () => window.clearInterval(id)
  }, [start, max])

  return (
    <span
      aria-hidden
      className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-white ring-2 ring-card"
    >
      <span key={count} className="animate-badge-pop motion-reduce:animate-none">
        {count}
      </span>
    </span>
  )
}
