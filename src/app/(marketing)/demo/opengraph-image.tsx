import { OG_CONTENT_TYPE, OG_SIZE, ogT, renderOgImage } from "@/features/marketing/shared/og"

export const alt = ogT("Demo.metaTitle")
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpengraphImage() {
  return renderOgImage({ eyebrow: ogT("Marketing.navDemo"), title: ogT("Demo.bannerText") })
}
