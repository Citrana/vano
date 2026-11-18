import { Badge } from "@/components/ui/badge"

/** Top of a marketing sub-page: badge-style eyebrow, H1, subtitle. */
export function PageIntro({
  eyebrow,
  title,
  subtitle,
  spacious = false,
  children,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  /** More room between the headline and the subtitle. */
  spacious?: boolean
  children?: React.ReactNode
}) {
  return (
    <section className="relative overflow-hidden px-4 pt-10 pb-6 md:pt-16 md:pb-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 [mask-image:linear-gradient(to_bottom,black_30%,transparent)]">
        <div className="absolute -top-24 left-1/2 size-[26rem] -translate-x-1/2 rounded-full bg-blush blur-3xl" />
      </div>
      <div className={`mx-auto flex max-w-3xl flex-col items-center text-center ${spacious ? "gap-6" : "gap-4"}`}>
        <Badge variant="brand">{eyebrow}</Badge>
        <h1 className="font-heading text-4xl leading-[1.1] font-extrabold tracking-tight text-balance md:text-6xl">{title}</h1>
        {subtitle ? <p className="max-w-2xl text-base text-muted-foreground text-pretty md:text-xl">{subtitle}</p> : null}
        {children}
      </div>
    </section>
  )
}
