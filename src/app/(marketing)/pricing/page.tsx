import type { Metadata } from "next"
import { BanknoteIcon, CoinsIcon, GiftIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { CompareTable } from "@/features/marketing/pricing/compare-table"
import { PlanCard } from "@/features/marketing/pricing/plan-card"
import { PLANS, TRIAL_MONTHS } from "@/features/marketing/pricing/plans"
import { CtaBand } from "@/features/marketing/shared/cta-band"
import { FaqList } from "@/features/marketing/shared/faq-list"
import { PageIntro } from "@/features/marketing/shared/page-intro"
import { Section } from "@/features/marketing/shared/section"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pricing")
  const title = t("metaTitle")
  const description = t("metaDescription")
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/pricing" },
    openGraph: { type: "website", siteName: "Vano", url: "/pricing", title, description },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function PricingPage() {
  const t = await getTranslations("Pricing")
  const locale = await getLocale()
  const faq = ([1, 2, 3] as const).map((n) => ({ id: `q${n}`, question: t(`faq.q${n}`), answer: t(`faq.a${n}`) }))

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title", { months: TRIAL_MONTHS })} subtitle={t("subtitle")}>
        <p className="mt-1 inline-flex items-center gap-2 rounded-lg border border-plum/15 bg-blush px-4 py-2 text-base font-semibold text-pretty">
          <GiftIcon className="size-5 shrink-0 text-plum" aria-hidden />
          {t("trialPill", { months: TRIAL_MONTHS })}
        </p>
      </PageIntro>
      <section aria-label={t("eyebrow")} className="px-4 pt-6 pb-10">
        <ul className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {PLANS.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} locale={locale} />
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-8 w-full max-w-3xl">
          <ul className="flex flex-col gap-2 px-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
            <li className="flex items-center gap-2">
              <CoinsIcon className="size-4 shrink-0" aria-hidden />
              {t("currencyNote")}
            </li>
            <li className="flex items-center gap-2">
              <BanknoteIcon className="size-4 shrink-0" aria-hidden />
              {t("mpesaNote")}
            </li>
          </ul>
        </div>
      </section>
      <CompareTable />
      <Section id="faq" eyebrow={t("faqEyebrow")} title={t("faqTitle")}>
        <div className="mx-auto w-full max-w-3xl">
          <FaqList items={faq} name="pricing-faq" />
        </div>
      </Section>
      <CtaBand />
    </>
  )
}
