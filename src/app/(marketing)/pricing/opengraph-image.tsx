import { OG_CONTENT_TYPE, OG_SIZE, ogT, renderOgImage } from "@/features/marketing/shared/og"
import { getTrialOffer } from "@/features/marketing/pricing/data"

export const alt = ogT("Pricing.metaTitle")
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function OpengraphImage() {
  const offer = await getTrialOffer("en")
  return renderOgImage({
    eyebrow: ogT("Pricing.eyebrow"),
    title: ogT("Pricing.title", offer),
    footer: ogT("Pricing.subtitle", offer),
  })
}
