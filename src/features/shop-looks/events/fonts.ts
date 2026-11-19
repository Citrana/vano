import { Anton, Dancing_Script, DM_Serif_Display, Playfair_Display } from "next/font/google"
import type { EventFontId } from "../../../../convex/lib/looks/events"

/**
 * Headline fonts for event & promo banners (open font licence, Google
 * Fonts, self-hosted by next/font). Not preloaded: a font downloads only
 * when a banner on the page uses it. The second line always uses the
 * shop font (Plus Jakarta Sans), so it stays easy to read.
 */
const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap", preload: false })
const playfair = Playfair_Display({ weight: "700", style: "italic", subsets: ["latin"], display: "swap", preload: false })
const dancing = Dancing_Script({ weight: "700", subsets: ["latin"], display: "swap", preload: false })
const dmSerif = DM_Serif_Display({ weight: "400", subsets: ["latin"], display: "swap", preload: false })

export const EVENT_FONT_CLASS: Record<EventFontId, string> = {
  modern: "font-heading font-extrabold tracking-tight",
  bold: `${anton.className} uppercase tracking-wide`,
  elegant: playfair.className,
  script: dancing.className,
  display: dmSerif.className,
}

/** Relative size per font, so every style fills the same space. */
export const EVENT_FONT_SCALE: Record<EventFontId, number> = {
  modern: 1,
  bold: 1.08,
  elegant: 1,
  script: 1.15,
  display: 1.05,
}
