import { ArrowRightIcon, LinkIcon, MessageCircleIcon, PaletteIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Reveal } from "@/features/marketing/shared/reveal"
import { Section } from "@/features/marketing/shared/section"

/**
 * Home's compact "Why Vano": three one-line benefits, each linking to its
 * detailed row on the Features page, plus a link to how it works there.
 */
export async function WhyStrip() {
  const t = await getTranslations("Home")
  const items = [
    { icon: PaletteIcon, title: t("whyDesignTitle"), line: t("whyDesignLine"), href: "/features#design" },
    { icon: MessageCircleIcon, title: t("whyWhatsappTitle"), line: t("whyWhatsappLine"), href: "/features#whatsapp" },
    { icon: LinkIcon, title: t("whyLinkTitle"), line: t("whyLinkLine"), href: "/features#link" },
  ]
  return (
    <Section eyebrow={t("highlightsEyebrow")} title={t("whyHeading")} className="pb-10 md:pb-14">
      <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
        {items.map(({ icon: Icon, title, line, href }, i) => (
          <li key={href}>
            <Reveal delay={i * 100} className="h-full">
              <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-6">
                <span className="flex size-11 items-center justify-center rounded-md bg-blush text-plum">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="flex-1 text-base text-foreground/80">{line}</p>
                <Link
                  href={href}
                  className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-plum underline-offset-4 hover:underline focus-ring"
                >
                  {t("learnMore")}
                  <span className="sr-only">: {title}</span>
                  <ArrowRightIcon className="size-4" aria-hidden />
                </Link>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
      <Link
        href="/features#how"
        className="inline-flex min-h-11 items-center gap-1.5 self-center rounded-md text-base font-semibold underline underline-offset-4 focus-ring"
      >
        {t("readyIn3Steps")}
        <ArrowRightIcon className="size-4" aria-hidden />
      </Link>
    </Section>
  )
}
