import { OG_CONTENT_TYPE, OG_SIZE, ogT, renderOgImage } from "@/features/marketing/shared/og"

export const alt = ogT("Help.metaTitle")
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpengraphImage() {
  return renderOgImage({ eyebrow: ogT("Help.eyebrow"), title: ogT("Help.title"), footer: ogT("Help.contactBody") })
}
