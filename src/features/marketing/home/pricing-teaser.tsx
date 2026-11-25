import { ArrowRightIcon, CheckIcon, GiftIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { getPlanCatalog, getTrialOffer } from "@/features/marketing/pricing/data"
import { formatPlanPrice, startingPriceMinor } from "@/features/marketing/pricing/plans"
import { Reveal } from "@/features/marketing/shared/reveal"

/** "2 months free on Pro, then from …" → /pricing. Numbers from the plan catalogue. */
export async function PricingTeaser() {
  const t = await getTranslations("Home")
  const locale = await getLocale()
  const catalog = await getPlanCatalog()
  const price = startingPriceMinor(catalog) ?? 0
  const offer = await getTrialOffer(locale)
  return (
    <section aria-labelledby="pricing-teaser-title" className="px-4 pb-24 md:pb-32">
      <Reveal className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 rounded-xl bg-blush px-6 py-10 text-center md:px-12">
        <span className="flex size-12 items-center justify-center rounded-lg bg-card text-plum">
          <GiftIcon className="size-6" aria-hidden />
        </span>
        <h2 id="pricing-teaser-title" className="font-heading text-2xl leading-tight font-extrabold tracking-tight text-balance md:text-4xl">
          {t("pricingTitle", { ...offer, price: formatPlanPrice(price, locale) })}
        </h2>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-base font-medium md:text-lg">
          {[t("trustNoPayment"), t("cancelAnytime")].map((line) => (
            <li key={line} className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-5 text-success" strokeWidth={3} aria-hidden />
              {line}
            </li>
          ))}
        </ul>
        <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
          {t("pricingLink")}
          <ArrowRightIcon aria-hidden />
        </Link>
      </Reveal>
    </section>
  )
}
