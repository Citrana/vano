import { OG_CONTENT_TYPE, OG_SIZE, ogT, renderOgImage } from "@/features/marketing/shared/og"

export const alt = ogT("Features.metaTitle")
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpengraphImage() {
  return renderOgImage({ eyebrow: ogT("Features.eyebrow"), title: ogT("Features.title"), footer: ogT("Features.subtitle") })
}
