import { Rotate3dIcon, SparklesIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/features/marketing/shared/reveal"
import { Section } from "@/features/marketing/shared/section"

/** Teaser only: these features don't exist yet and are labelled so. */
export async function ComingSoon() {
  const t = await getTranslations("Features")
  const tm = await getTranslations("Marketing")
  const items = [
    { icon: Rotate3dIcon, title: t("soon360"), body: t("soon360Body") },
    { icon: SparklesIcon, title: t("soonTryOn"), body: t("soonTryOnBody") },
  ]
  return (
    <Section eyebrow={t("soonEyebrow")} title={t("soonTitle")} subtitle={t("soonSubtitle")}>
      <ul className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-2 md:gap-6">
        {items.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <Reveal delay={i * 120} className="h-full">
              <div className="flex h-full flex-col gap-4 rounded-xl border border-plum/40 bg-card p-6 md:p-8">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-blush text-plum">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <Badge className="h-7 px-3 text-sm">{tm("comingSoon")}</Badge>
                </div>
                <h3 className="text-xl font-bold">{title}</h3>
                <p className="text-base text-foreground/90">{body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  )
}
