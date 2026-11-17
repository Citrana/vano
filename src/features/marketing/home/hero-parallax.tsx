"use client"

import { useEffect, useRef, type ReactNode } from "react"

const MAX_SHIFT = 6 // px in each direction

/**
 * Very subtle mouse parallax on the hero phone. Desktop with a mouse only,
 * off for reduced motion; at most one style write per animation frame.
 */
export function HeroParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ok = window.matchMedia("(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)")
    if (!ok.matches) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2 * MAX_SHIFT
        const y = (e.clientY / window.innerHeight - 0.5) * 2 * MAX_SHIFT
        if (ref.current) ref.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      })
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => {
      window.removeEventListener("pointermove", onMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={ref} className="transition-transform duration-300 ease-out motion-reduce:transition-none">
      {children}
    </div>
  )
}
