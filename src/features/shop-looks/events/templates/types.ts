import type { ShapeName } from "../shapes"

/**
 * How an event banner template is drawn (CLAUDE.md "Shop looks"). A
 * banner has two decoration zones (start / end edges on wide banners, top
 * / bottom bands on square and story images) and the text box between
 * them, so shapes and stickers can never cover or cut the text.
 *
 * Positions are inside a zone: `t` along the edge (0–1), `u` across it
 * from the banner's outer edge (0–1), `size` as a share of the zone's
 * smaller side. Keep `u + size / 2 <= 0.95` (tested) so nothing is
 * clipped on the text side. The second zone mirrors the first.
 */
export type ZonePoint = { t: number; u: number; size: number; rotate?: number }

export type DecorItem = ZonePoint & { shape: ShapeName; tone: 0 | 1; opacity?: number }

export type StickerSlot = ZonePoint & { side: 0 | 1 }

export type TemplateLayers = {
  align: "center" | "start"
  /** Drawn in both zones (mirrored), under the stickers. */
  decor: readonly DecorItem[]
  /** Where the seller's stickers go, in order (PROMO_STICKERS_MAX). */
  slots: readonly StickerSlot[]
}

export const DEFAULT_SLOTS: readonly StickerSlot[] = [
  { side: 0, t: 0.7, u: 0.5, size: 0.56, rotate: -12 },
  { side: 1, t: 0.7, u: 0.5, size: 0.56, rotate: 10 },
  { side: 0, t: 0.24, u: 0.6, size: 0.36, rotate: 8 },
  { side: 1, t: 0.24, u: 0.6, size: 0.36, rotate: -8 },
]
