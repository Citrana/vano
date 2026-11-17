import { ArrowRightIcon, LinkIcon, MessageCircleIcon, PaletteIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Reveal } from "@/features/marketing/shared/reveal"
import { Section } from "@/features/marketing/shared/section"

/** Three feature highlights (copy shared with the Features page). */
export async function Highlights() {
  const t = await getTranslations("Home")
  const tf = await getTranslations("Features")
  const items = [
    { icon: PaletteIcon, title: tf("designTitle"), body: tf("designBody") },
    { icon: MessageCircleIcon, title: tf("whatsappTitle"), body: tf("whatsappBody") },
    { icon: LinkIcon, title: tf("linkTitle"), body: tf("linkBody") },
  ]
  return (
    <Section eyebrow={t("highlightsEyebrow")} title={t("highlightsTitle")} className="bg-card/60">
      <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
        {items.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <Reveal delay={i * 100} className="h-full">
              <div className="flex h-full flex-col gap-3 rounded-2xl bg-card p-6 shadow-soft ring-1 ring-foreground/5">
                <span className="flex size-11 items-center justify-center rounded-xl bg-blush text-plum">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="text-base text-muted-foreground">{body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
      <Link href="/features" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full self-center sm:w-auto" })}>
        {t("seeAllFeatures")}
        <ArrowRightIcon aria-hidden />
      </Link>
    </Section>
  )
}
