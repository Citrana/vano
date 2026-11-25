import type { Metadata } from "next"
import { BanknoteIcon, CoinsIcon, GiftIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { cn } from "cn"
import { CompareTable } from "@/features/marketing/pricing/compare-table"
import { PlanCard } from "@/features/marketing/pricing/plan-card"
import { getPlanCatalog, getTrialOffer } from "@/features/marketing/pricing/data"
import { buildComparison, buildPlanCards } from "@/features/marketing/pricing/plans"
import { planNameIn } from "../../../../convex/lib/planCatalog"
import { CtaBand } from "@/features/marketing/shared/cta-band"
import { FaqList } from "@/features/marketing/shared/faq-list"
import { PageIntro } from "@/features/marketing/shared/page-intro"
import { Section } from "@/features/marketing/shared/section"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pricing")
  const title = t("metaTitle")
  const description = t("metaDescription", await getTrialOffer(await getLocale()))
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
  const catalog = await getPlanCatalog()
  const plans = buildPlanCards(catalog, locale, (plan) => t("everythingIn", { plan }))
  const months = catalog.trialMonths
  const trialPlan = planNameIn(catalog, catalog.trialPlan, locale)
  const business = planNameIn(catalog, "business", locale)
  const freeProducts = catalog.features.find((f) => f.key === "products")?.values.free
  const faq = [
    {
      id: "q1",
      question: t("faq.q1"),
      answer: t("faq.a1", {
        months,
        plan: trialPlan,
        free: planNameIn(catalog, "free", locale),
        count: typeof freeProducts === "number" ? freeProducts : 0,
      }),
    },
    { id: "q2", question: t("faq.q2"), answer: t("faq.a2", { plan: trialPlan, business }) },
    { id: "q3", question: t("faq.q3"), answer: t("faq.a3") },
  ]

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title", { months, plan: trialPlan })} subtitle={t("subtitle", { plan: trialPlan })}>
        <p className="mt-1 inline-flex items-center gap-2 rounded-lg border border-plum/15 bg-blush px-4 py-2 text-base font-semibold text-pretty">
          <GiftIcon className="size-5 shrink-0 text-plum" aria-hidden />
          {t("trialPill", { months, plan: trialPlan })}
        </p>
      </PageIntro>
      <section aria-label={t("eyebrow")} className="px-4 pt-6 pb-10">
        <ul className={cn("mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2 lg:gap-5", plans.length >= 4 ? "lg:grid-cols-4" : plans.length === 3 && "lg:grid-cols-3")}>
          {plans.map((plan) => (
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
      <CompareTable plans={plans} groups={buildComparison(catalog, locale)} />
      <Section id="faq" eyebrow={t("faqEyebrow")} title={t("faqTitle")}>
        <div className="mx-auto w-full max-w-3xl">
          <FaqList items={faq} name="pricing-faq" />
        </div>
      </Section>
      <CtaBand />
    </>
  )
}
