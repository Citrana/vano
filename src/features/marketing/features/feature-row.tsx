import { CheckIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "cn"
import { Reveal } from "@/features/marketing/shared/reveal"

/**
 * One detailed feature: icon, title, short explanation, three bullets and
 * a visual. Side by side from md (flipped with `reverse`), stacked on
 * phones. `tint` puts the row on the blush panel (Design only).
 */
export function FeatureRow({
  id,
  icon,
  title,
  body,
  bullets,
  visual,
  reverse = false,
  tint = false,
}: {
  /** Anchor for deep links from Home (e.g. /features#design). */
  id?: string
  icon: ReactNode
  title: string
  body: string
  bullets: string[]
  visual: ReactNode
  reverse?: boolean
  tint?: boolean
}) {
  return (
    <Reveal>
      <div
        id={id}
        className={cn(
          "scroll-mt-24",
          "grid items-center gap-8 md:grid-cols-2 md:gap-14",
          tint ? "rounded-xl bg-blush p-6 md:grid-cols-[1fr_1.25fr] md:p-10" : "md:px-6",
        )}
      >
        <div className={cn("flex min-w-0 flex-col gap-4", reverse && "md:order-2")}>
          <span className="flex size-12 items-center justify-center rounded-lg bg-card text-plum">{icon}</span>
          <h3 className="font-heading text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">{title}</h3>
          <p className="max-w-lg text-base text-foreground/80 md:text-lg">{body}</p>
          <ul className="flex flex-col gap-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-base">
                <CheckIcon className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={3} aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className={cn("min-w-0", reverse && "md:order-1")}>{visual}</div>
      </div>
    </Reveal>
  )
}
