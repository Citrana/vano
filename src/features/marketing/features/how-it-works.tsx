import { Share2Icon, ShirtIcon, StoreIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Reveal } from "@/features/marketing/shared/reveal"
import { Section } from "@/features/marketing/shared/section"

/**
 * Detailed how-it-works (anchor #how): a horizontal flow on desktop with a
 * thin line joining the numbered circles, a vertical one on phones.
 */
export async function HowItWorks() {
  const t = await getTranslations("Features")
  const steps = [
    { icon: StoreIcon, title: t("how1"), body: t("how1Body") },
    { icon: ShirtIcon, title: t("how2"), body: t("how2Body") },
    { icon: Share2Icon, title: t("how3"), body: t("how3Body") },
  ]
  return (
    <Section id="how" eyebrow={t("howEyebrow")} title={t("howTitle")} className="bg-card/60">
      <ol className="relative mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-3 md:gap-10">
        {/* Connecting line: across the circles on desktop, down the left edge on phones. */}
        <span aria-hidden className="absolute top-6 right-[calc(100%/6)] left-[calc(100%/6)] hidden h-px bg-border-strong md:block" />
        <span aria-hidden className="absolute top-6 bottom-6 left-6 w-px bg-border-strong md:hidden" />
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="relative">
            <Reveal delay={i * 120} className="flex gap-4 md:flex-col md:items-center md:text-center">
              <div className="flex shrink-0 items-center gap-2">
                <span className="relative z-10 flex size-12 items-center justify-center rounded-full bg-ink text-lg font-extrabold text-cream ring-4 ring-background">
                  {i + 1}
                </span>
              </div>
              <div className="flex flex-col gap-2 md:items-center">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blush text-coral-strong">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="text-lg font-bold md:text-xl">{title}</h3>
                <p className="text-base text-foreground/80">{body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}
