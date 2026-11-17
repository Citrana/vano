import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ComingSoon } from "@/features/marketing/features/coming-soon"
import { FeatureGrid } from "@/features/marketing/features/feature-grid"
import { HowItWorks } from "@/features/marketing/features/how-it-works"
import { CtaBand } from "@/features/marketing/shared/cta-band"
import { PageIntro } from "@/features/marketing/shared/page-intro"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Features")
  const title = t("metaTitle")
  const description = t("metaDescription")
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/features" },
    openGraph: { type: "website", siteName: "Vano", url: "/features", title, description },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function FeaturesPage() {
  const t = await getTranslations("Features")
  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      <FeatureGrid />
      <HowItWorks />
      <ComingSoon />
      <CtaBand />
    </>
  )
}
