import { OG_CONTENT_TYPE, OG_SIZE, ogT, renderOgImage } from "@/features/marketing/shared/og"
import { TRIAL_MONTHS } from "@/features/marketing/pricing/plans"

// Default share image (Home, and shops without their own image).
export const alt = ogT("Home.metaTitle")
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpengraphImage() {
  return renderOgImage({
    title: ogT.raw("Home.heroTitle") as string,
    footer: `${ogT("Home.trustTrial", { months: TRIAL_MONTHS })} · ${ogT("Home.trustNoPayment")}`,
  })
}
