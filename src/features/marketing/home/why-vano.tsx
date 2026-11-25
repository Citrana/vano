import {
  ArrowRightIcon,
  LinkIcon,
  MessageCircleIcon,
  PaletteIcon,
  Repeat2Icon,
  SearchIcon,
  TagIcon,
  type LucideIcon,
} from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Reveal } from "@/features/marketing/shared/reveal"

type Item = { icon: LucideIcon; title: string; line: string; href?: string }

// 3 columns on computers, 2 on tablets (the third card of a row spans both,
// so the two styles never share a line), 1 on phones.
const GRID = "grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3"
const LAST_SPANS = "md:last:col-span-2 lg:last:col-span-1"

/**
 * Home's "Why Vano", between the hero text and the phone: the problem (new
 * posts bury older stock), the three answers (stronger cards), then the
 * three original reasons (lighter cards, each linking to its Features row)
 * and a link to how it works. A blush band so it stands apart from the hero.
 */
export async function WhyVano() {
  const t = await getTranslations("Home")
  const answers: Item[] = [
    { icon: Repeat2Icon, title: t("whyRepostTitle"), line: t("whyRepostLine") },
    { icon: TagIcon, title: t("whySaleTitle"), line: t("whySaleLine") },
    { icon: SearchIcon, title: t("whyFindTitle"), line: t("whyFindLine") },
  ]
  const reasons: Item[] = [
    { icon: PaletteIcon, title: t("whyDesignTitle"), line: t("whyDesignLine"), href: "/features#design" },
    { icon: MessageCircleIcon, title: t("whyWhatsappTitle"), line: t("whyWhatsappLine"), href: "/features#whatsapp" },
    { icon: LinkIcon, title: t("whyLinkTitle"), line: t("whyLinkLine"), href: "/features#link" },
  ]

  return (
    <section aria-labelledby="why-vano-title" className="border-y bg-blush/40 px-4 py-14 md:py-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 md:gap-12">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="text-sm font-semibold tracking-wide text-plum uppercase">{t("highlightsEyebrow")}</p>
          <h2
            id="why-vano-title"
            className="font-heading text-2xl leading-tight font-extrabold tracking-tight text-balance md:text-4xl"
          >
            {t("buryTitle")}
          </h2>
          <p className="text-base text-muted-foreground text-pretty md:text-lg">{t("buryLead")}</p>
        </Reveal>

        <div className="flex flex-col gap-4 md:gap-6">
          <ul className={GRID}>
            {answers.map((item, i) => (
              <li key={item.title} className={LAST_SPANS}>
                <Reveal delay={i * 100} className="h-full">
                  <div className="flex h-full flex-col gap-3 rounded-xl border border-plum/25 bg-card p-6">
                    <span className="flex size-11 items-center justify-center rounded-md bg-plum text-cream">
                      <item.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="text-lg font-bold text-balance">{item.title}</h3>
                    <p className="text-base text-foreground/80">{item.line}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

          <ul className={GRID}>
            {reasons.map((item, i) => (
              <li key={item.title} className={LAST_SPANS}>
                <Reveal delay={300 + i * 100} className="h-full">
                  <div className="flex h-full flex-col gap-2 rounded-xl border bg-card/60 p-5">
                    <span className="flex size-10 items-center justify-center rounded-md bg-blush text-plum">
                      <item.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="flex-1 text-sm text-muted-foreground">{item.line}</p>
                    <Link
                      href={item.href ?? "/features"}
                      className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-plum underline-offset-4 hover:underline focus-ring"
                    >
                      {t("learnMore")}
                      <span className="sr-only">: {item.title}</span>
                      <ArrowRightIcon className="size-4" aria-hidden />
                    </Link>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/features#how"
          className="inline-flex min-h-11 items-center gap-1.5 self-center rounded-md text-base font-semibold underline underline-offset-4 focus-ring"
        >
          {t("readyIn3Steps")}
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}
