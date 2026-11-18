"use client"

import { ZapIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "cn"

/**
 * Phone outline with skeleton content and a loading bar that fills once
 * when it scrolls into view (instantly full with reduced motion). No
 * numbers: it illustrates, it doesn't measure.
 */
export function PhoneSpeed({ note }: { note: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoaded(true)
          observer.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} aria-hidden className="mx-auto flex w-full max-w-xs flex-col items-center gap-4 select-none">
      <div className="w-48 rounded-[2rem] bg-ink p-2 shadow-float">
        <div className="flex flex-col gap-2 rounded-[1.6rem] bg-background p-3">
          {/* status bar: signal + loading bar */}
          <div className="flex items-center gap-2">
            <span className="flex items-end gap-0.5">
              {[4, 6, 8, 10].map((h, i) => (
                <span key={h} className={cn("w-1 rounded-sm", i < 2 ? "bg-foreground" : "bg-foreground/20")} style={{ height: h }} />
              ))}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  "block h-full rounded-full bg-success transition-[width] duration-[1600ms] ease-out motion-reduce:w-full motion-reduce:transition-none",
                  loaded ? "w-full" : "w-[12%]",
                )}
              />
            </span>
          </div>
          <span className="h-3 w-20 rounded-full bg-foreground/80" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="flex flex-col gap-1 rounded-lg bg-card p-1 border">
                <span className="aspect-[4/5] rounded-md bg-blush" />
                <span className="h-1.5 w-3/4 rounded-full bg-foreground/60" />
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold border">
        <ZapIcon className="size-4 text-success" />
        {note}
      </p>
    </div>
  )
}
