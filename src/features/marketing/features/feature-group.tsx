import type { ReactNode } from "react"
import { Reveal } from "@/features/marketing/shared/reveal"

/** A group of feature rows under a small numbered label ("1 · Set up your shop"). */
export function FeatureGroup({ number, label, children }: { number: number; label: string; children: ReactNode }) {
  const headingId = `group-${number}`
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-10 md:gap-14">
      <Reveal>
        <h2 id={headingId} className="flex items-center gap-3 text-sm font-semibold tracking-wide text-plum uppercase">
          <span className="flex size-7 items-center justify-center rounded-full bg-plum text-xs text-white">{number}</span>
          {label}
          <span aria-hidden className="h-px flex-1 bg-border" />
        </h2>
      </Reveal>
      {children}
    </section>
  )
}
