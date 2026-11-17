import { ArrowRightIcon, GiftIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { STARTING_PRICE_MINOR, TRIAL_MONTHS, formatPlanPrice } from "@/features/marketing/pricing/plans"
import { Reveal } from "@/features/marketing/shared/reveal"

/** "Start free for 2 months, then from …" → /pricing. Numbers from plans.ts. */
export async function PricingTeaser() {
  const t = await getTranslations("Home")
  const locale = await getLocale()
  return (
    <section aria-labelledby="pricing-teaser-title" className="px-4 pb-16 md:pb-24">
      <Reveal className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 rounded-3xl bg-blush px-6 py-10 text-center md:px-12">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-card text-plum shadow-soft">
          <GiftIcon className="size-6" aria-hidden />
        </span>
        <h2 id="pricing-teaser-title" className="font-heading text-2xl leading-tight font-extrabold tracking-tight text-balance md:text-4xl">
          {t("pricingTitle", { months: TRIAL_MONTHS, price: formatPlanPrice(STARTING_PRICE_MINOR, locale) })}
        </h2>
        <p className="text-base text-foreground/80 md:text-lg">{t("pricingBody")}</p>
        <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
          {t("pricingLink")}
          <ArrowRightIcon aria-hidden />
        </Link>
      </Reveal>
    </section>
  )
}
