import { Share2Icon, ShirtIcon, StoreIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { highlight } from "./highlight"
import { Reveal } from "./reveal"
import { Section } from "./section"

export async function HowItWorks() {
  const t = await getTranslations("Landing")
  const steps = [
    { icon: StoreIcon, title: t("step1"), body: t("step1Body") },
    { icon: ShirtIcon, title: t("step2"), body: t("step2Body") },
    { icon: Share2Icon, title: t("step3"), body: t("step3Body") },
  ]
  return (
    <Section id="how" eyebrow={t("howEyebrow")} title={t.rich("howTitle", highlight)}>
      <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <Reveal delay={i * 120} className="h-full">
              <div className="flex h-full gap-4 rounded-2xl bg-card p-5 shadow-soft ring-1 ring-foreground/5 md:flex-col md:p-7">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blush text-coral-strong md:size-14">
                  <Icon className="size-6" aria-hidden />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {t("stepLabel", { n: i + 1 })}
                  </p>
                  <h3 className="text-lg font-bold md:text-xl">{title}</h3>
                  <p className="text-muted-foreground">{body}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}
