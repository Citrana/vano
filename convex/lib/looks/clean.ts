import { normalizeHex } from "./color";
import { BANNER_TEXT_MAX, FOCUS_MAX, FOCUS_MIN, ZOOM_MAX, ZOOM_MIN } from "./banners";
import type { BannerFacet, BannerText, StoredLook } from "./validators";

/**
 * Value checks the validators can't express (CLAUDE.md "Shop looks").
 * Pure: the editor uses it before saving, `shopLooks.saveDraft` again.
 * Returns the cleaned look, or null when a value is out of range.
 */

/** Trims, collapses whitespace and drops control characters. Empty → undefined. */
export function cleanBannerText(text: BannerText | undefined): BannerText | undefined | null {
  if (text === undefined) return undefined;
  const value = text.value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (value.length === 0) return undefined;
  if (value.length > BANNER_TEXT_MAX) return null;
  return { value, align: text.align };
}

const inRange = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;

function cleanBanner(banner: BannerFacet): BannerFacet | null {
  if (banner.kind === "none") return banner;
  const text = cleanBannerText(banner.text);
  if (text === null) return null;
  if (banner.kind === "photo") {
    if (!inRange(banner.focusX, FOCUS_MIN, FOCUS_MAX) || !inRange(banner.focusY, FOCUS_MIN, FOCUS_MAX)) return null;
    if (!inRange(banner.zoom, ZOOM_MIN, ZOOM_MAX)) return null;
  }
  return { ...banner, text };
}

export function cleanLook(look: StoredLook): StoredLook | null {
  const { colors, buttons, banner } = look.overrides;
  const overrides: StoredLook["overrides"] = {};
  if (colors) {
    const accent = normalizeHex(colors.accent);
    const background = normalizeHex(colors.background);
    if (!accent || !background) return null;
    overrides.colors = { accent, background };
  }
  if (buttons) overrides.buttons = { shape: buttons.shape, fill: buttons.fill, weight: buttons.weight };
  if (banner) {
    const cleaned = cleanBanner(banner);
    if (!cleaned) return null;
    overrides.banner = cleaned;
  }
  return { v: 1, preset: look.preset, overrides };
}

/** The banner photo a look uses, if any. */
export function lookImageIds(look: StoredLook | undefined | null) {
  const banner = look?.overrides.banner;
  return banner?.kind === "photo" ? [banner.imageId] : [];
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

/** Same look, whatever the key order (stored docs don't keep it). */
export function sameLook(a: StoredLook | null | undefined, b: StoredLook | null | undefined): boolean {
  return JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
}
