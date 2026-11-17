"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "cn"

// useLayoutEffect warns during SSR; this runs it only in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Fades its content in when it scrolls into view. Server-rendered visible
 * (works without JS); content already on screen at load never hides, and
 * reduced-motion users see no animation.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle")

  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    setState("hidden")
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown")
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={state === "shown" && delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "motion-safe:transition-[opacity,translate] motion-safe:duration-700 motion-safe:ease-out",
        state === "hidden" && "motion-safe:translate-y-6 motion-safe:opacity-0",
        className,
      )}
    >
      {children}
    </div>
  )
}
