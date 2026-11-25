import { OG_CONTENT_TYPE, OG_SIZE, ogT, renderOgImage } from "@/features/marketing/shared/og"
import { getTrialOffer } from "@/features/marketing/pricing/data"

// Default share image (Home, and shops without their own image).
export const alt = ogT("Home.metaTitle")
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function OpengraphImage() {
  const offer = await getTrialOffer("en")
  return renderOgImage({
    title: ogT.raw("Home.heroTitle") as string,
    footer: `${ogT("Home.trustTrial", offer)} · ${ogT("Home.trustNoPayment")}`,
  })
}
