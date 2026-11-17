import type { ReactNode } from "react"
import { cn } from "cn"
import { Reveal } from "@/features/marketing/shared/reveal"

/** Shared landing section: width, spacing, eyebrow + title + subtitle. */
export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: {
  id?: string
  eyebrow: string
  title: ReactNode
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-20 px-4 py-16 md:py-24", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 md:gap-14">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="text-sm font-semibold tracking-wide text-plum uppercase">{eyebrow}</p>
          <h2 id={headingId} className="font-heading text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-5xl">
            {title}
          </h2>
          {subtitle ? <p className="text-base text-muted-foreground text-pretty md:text-lg">{subtitle}</p> : null}
        </Reveal>
        {children}
      </div>
    </section>
  )
}
