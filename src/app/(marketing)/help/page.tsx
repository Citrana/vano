import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { ContactCard } from "@/features/marketing/help/contact-card"
import { HelpFaq, type HelpGroup } from "@/features/marketing/help/help-faq"
import { getPlanTexts } from "@/features/marketing/pricing/data"
import { CtaBand } from "@/features/marketing/shared/cta-band"
import { PageIntro } from "@/features/marketing/shared/page-intro"

const GROUPS = ["start", "products", "orders", "link", "pricing", "account"] as const
const QUESTIONS = [1, 2, 3] as const

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Help")
  const title = t("metaTitle")
  const description = t("metaDescription")
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/help" },
    openGraph: { type: "website", siteName: "Vano", url: "/help", title, description },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function HelpPage() {
  const t = await getTranslations("Help")
  // Plan names, the trial length and the period come from the config / code, never the text.
  const plans = await getPlanTexts(await getLocale())
  const groups: HelpGroup[] = GROUPS.map((key) => ({
    key,
    title: t(`groups.${key}.title`),
    items: QUESTIONS.map((n) => ({
      id: `${key}-${n}`,
      question: t(`groups.${key}.q${n}`),
      answer: key === "pricing" ? t(`groups.pricing.a${n}`, plans) : t(`groups.${key}.a${n}`),
    })),
  }))

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 pt-4 pb-16 md:pb-24">
        <HelpFaq groups={groups} />
        <ContactCard />
      </div>
      <CtaBand />
    </>
  )
}
