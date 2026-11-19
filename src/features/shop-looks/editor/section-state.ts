import { sameLook } from "../../../../convex/lib/looks/clean"
import type { LookOverrides, StoredLook } from "../../../../convex/lib/looks/validators"

/**
 * Pure helpers for the sectioned "Shop look" editor (no React), so they
 * can be unit-tested: which section the URL asks for, whether a section's
 * part of the look differs from what's live, and the preview products.
 */

/** The section in `?section=`, else the remembered one, else the first. */
export function parseSection<K extends string>(
  value: string | null | undefined,
  keys: readonly K[],
  remembered?: string | null,
): K {
  const known = (v: string | null | undefined): v is K => v != null && (keys as readonly string[]).includes(v)
  if (known(value)) return value
  if (known(remembered)) return remembered
  return keys[0]
}

/** The look's preset differs. */
export function presetChanged(draft: StoredLook, live: StoredLook): boolean {
  return draft.preset !== live.preset
}

/** One override (colors, buttons, banner, promo…) differs, whatever the key order. */
export function facetChanged(key: keyof LookOverrides) {
  return (draft: StoredLook, live: StoredLook): boolean =>
    !sameLook(
      { v: 1, preset: "classic", overrides: { [key]: draft.overrides[key] } },
      { v: 1, preset: "classic", overrides: { [key]: live.overrides[key] } },
    )
}

export const PREVIEW_MIN = 2
export const PREVIEW_MAX = 4

/**
 * 2 to 4 products for the preview: the shop's own first; samples top them
 * up when the shop has fewer than 2 (so the grid never shows one product
 * next to empty space). `sample` = at least one sample is shown.
 */
export function previewProducts<P>(own: readonly P[], samples: readonly P[]): { products: P[]; sample: boolean } {
  if (own.length >= PREVIEW_MIN) return { products: own.slice(0, PREVIEW_MAX), sample: false }
  return { products: [...own, ...samples].slice(0, PREVIEW_MAX), sample: true }
}
