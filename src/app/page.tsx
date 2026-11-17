import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ComingSoon } from "@/features/landing/coming-soon"
import { DemoPreview } from "@/features/landing/demo-preview"
import { FinalCta } from "@/features/landing/final-cta"
import { Hero } from "@/features/landing/hero"
import { HowItWorks } from "@/features/landing/how-it-works"
import { LandingFooter } from "@/features/landing/landing-footer"
import { LandingNav } from "@/features/landing/landing-nav"
import { PlatformNotice } from "@/features/landing/platform-notice"
import { WhyVano } from "@/features/landing/why-vano"

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

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PlatformNotice />
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <WhyVano />
        <DemoPreview />
        <ComingSoon />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
