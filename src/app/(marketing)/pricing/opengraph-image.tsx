import { OG_CONTENT_TYPE, OG_SIZE, ogT, renderOgImage } from "@/features/marketing/shared/og"
import { TRIAL_MONTHS } from "@/features/marketing/pricing/plans"

export const alt = ogT("Pricing.metaTitle")
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: ogT("Pricing.eyebrow"),
    title: ogT("Pricing.title", { months: TRIAL_MONTHS }),
    footer: ogT("Pricing.subtitle"),
  })
}
