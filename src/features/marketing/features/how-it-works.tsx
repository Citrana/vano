import { Share2Icon, ShirtIcon, StoreIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Reveal } from "@/features/marketing/shared/reveal"
import { Section } from "@/features/marketing/shared/section"

/** Detailed how-it-works (anchor #how). */
export async function HowItWorks() {
  const t = await getTranslations("Features")
  const steps = [
    { icon: StoreIcon, title: t("how1"), body: t("how1Body") },
    { icon: ShirtIcon, title: t("how2"), body: t("how2Body") },
    { icon: Share2Icon, title: t("how3"), body: t("how3Body") },
  ]
  return (
    <Section id="how" eyebrow={t("howEyebrow")} title={t("howTitle")} className="bg-card/60">
      <ol className="mx-auto grid w-full max-w-4xl gap-4">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <Reveal delay={i * 120}>
              <div className="flex gap-4 rounded-2xl bg-card p-5 shadow-soft ring-1 ring-foreground/5 md:gap-6 md:p-7">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-extrabold text-cream md:size-14">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="inline-flex items-center gap-2 text-lg font-bold md:text-xl">
                    <Icon className="size-5 text-coral-strong" aria-hidden />
                    {title}
                  </h3>
                  <p className="text-base text-muted-foreground md:text-lg">{body}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}
