import { PRESET_IDS, PRESETS, presetLook } from "../../../convex/lib/looks/presets"
import { resolveLook, type ResolvedLook } from "../../../convex/lib/looks/resolve"
import type { PresetId } from "../../../convex/lib/looks/validators"

/**
 * Presets for the UI (CLAUDE.md "Shop looks"). The list and values live in
 * convex/lib/looks/presets.ts; the seller editor, the landing phone, the
 * Features page and the demo shop all use them, so what visitors see is
 * what sellers get. Names: `ShopLooks.presets.<id>`.
 */
export { PRESET_IDS, type PresetId }

/** Each preset, resolved once. */
export const PRESET_LOOKS = Object.fromEntries(PRESET_IDS.map((id) => [id, resolveLook(presetLook(id))])) as Record<
  PresetId,
  ResolvedLook<string>
>

/** The few looks the landing phone and demo switch cycle through (fits 360px). */
export const SHOWCASE_PRESETS = ["blush", "lavender", "emeraldGold", "noir", "kitenge"] as const satisfies readonly PresetId[]

/** Swatch colours (background + accent) for a preset dot. */
export function presetSwatch(id: PresetId): { bg: string; accent: string } {
  const { colors } = PRESETS[id]
  return { bg: colors.background, accent: colors.accent }
}

export function isPresetId(value: string): value is PresetId {
  return (PRESET_IDS as readonly string[]).includes(value)
}
