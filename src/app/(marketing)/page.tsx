import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { DemoTeaser } from "@/features/marketing/home/demo-teaser"
import { Hero } from "@/features/marketing/home/hero"
import { LegacyAnchorRedirect } from "@/features/marketing/home/legacy-anchor-redirect"
import { PricingTeaser } from "@/features/marketing/home/pricing-teaser"
import { WhyStrip } from "@/features/marketing/home/why-strip"
import { CtaBand } from "@/features/marketing/shared/cta-band"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home")
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
      <LegacyAnchorRedirect />
      <Hero />
      <WhyStrip />
      <DemoTeaser />
      <PricingTeaser />
      <CtaBand />
    </>
  )
}
