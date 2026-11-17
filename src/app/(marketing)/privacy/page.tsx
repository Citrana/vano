import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LegalPage } from "@/features/marketing/shared/legal-page"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal")
  // Placeholder text: keep it out of search results until the real version ships.
  return { title: t("privacyTitle"), robots: { index: false }, alternates: { canonical: "/privacy" } }
}

export default function PrivacyPage() {
  return <LegalPage page="privacy" />
}
