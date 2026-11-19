import { OG_CONTENT_TYPE, OG_SIZE, ogT, renderOgImage } from "@/features/marketing/shared/og"
import { getPlanCatalog } from "@/features/marketing/pricing/data"

export const alt = ogT("Pricing.metaTitle")
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function OpengraphImage() {
  const { trialMonths } = await getPlanCatalog()
  return renderOgImage({
    eyebrow: ogT("Pricing.eyebrow"),
    title: ogT("Pricing.title", { months: trialMonths }),
    footer: ogT("Pricing.subtitle"),
  })
}
