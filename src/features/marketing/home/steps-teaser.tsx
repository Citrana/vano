import { Share2Icon, ShirtIcon, StoreIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Reveal } from "@/features/marketing/shared/reveal"
import { Section } from "@/features/marketing/shared/section"

export async function StepsTeaser() {
  const t = await getTranslations("Home")
  const steps = [
    { icon: StoreIcon, title: t("step1"), body: t("step1Body") },
    { icon: ShirtIcon, title: t("step2"), body: t("step2Body") },
    { icon: Share2Icon, title: t("step3"), body: t("step3Body") },
  ]
  return (
    <Section id="how" eyebrow={t("stepsEyebrow")} title={t("stepsTitle")}>
      <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <Reveal delay={i * 120} className="h-full">
              <div className="flex h-full items-center gap-4 rounded-2xl bg-card p-5 shadow-soft ring-1 ring-foreground/5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blush text-coral-strong">
                  <Icon className="size-6" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-wide text-plum uppercase">{t("stepLabel", { n: i + 1 })}</p>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="text-base text-muted-foreground">{body}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}
