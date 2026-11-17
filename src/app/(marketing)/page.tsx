import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ComingSoon } from "@/features/marketing/features/coming-soon"
import { WhyVano } from "@/features/marketing/features/feature-grid"
import { HowItWorks } from "@/features/marketing/features/how-it-works"
import { DemoPreview } from "@/features/marketing/home/demo-preview"
import { Hero } from "@/features/marketing/home/hero"
import { CtaBand } from "@/features/marketing/shared/cta-band"
import { Faq } from "@/features/marketing/shared/faq-list"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Landing")
  const title = t("metaTitle")
  const description = t("metaDescription")
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: { type: "website", siteName: "Vano", url: "/", title, description },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <WhyVano />
      <DemoPreview />
      <ComingSoon />
      <Faq />
      <CtaBand />
    </>
  )
}
