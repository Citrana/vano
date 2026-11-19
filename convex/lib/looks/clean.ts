import { isStickerId } from "../../../src/assets/images/stickers/manifest";
import { normalizeHex } from "./color";
import { BANNER_TEXT_MAX, FOCUS_MAX, FOCUS_MIN, ZOOM_MAX, ZOOM_MIN } from "./banners";
import { EVENT_TEMPLATES, PROMO_HEADLINE_MAX, PROMO_STICKERS_MAX, PROMO_SUBLINE_MAX } from "./events";
import { scheduleShapeProblem } from "./schedule";
import type { BannerFacet, BannerText, PromoFacet, StoredLook } from "./validators";

/**
 * Value checks the validators can't express (CLAUDE.md "Shop looks").
 * Pure: the editor uses it before saving, `shopLooks.saveDraft` again.
 * Returns the cleaned look, or null when a value is out of range.
 */

/** One line of text: control characters dropped, whitespace collapsed, trimmed. */
export function cleanLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/** Trims, collapses whitespace and drops control characters. Empty → undefined. */
export function cleanBannerText(text: BannerText | undefined): BannerText | undefined | null {
  if (text === undefined) return undefined;
  const value = cleanLine(text.value);
  if (value.length === 0) return undefined;
  if (value.length > BANNER_TEXT_MAX) return null;
  return { value, align: text.align };
}

/** Checks an event & promo banner: texts, template palette, stickers, schedule shape. */
export function cleanPromo(promo: PromoFacet): PromoFacet | null {
  const { design } = promo;
  const template = EVENT_TEMPLATES[design.template];
  if (!template.palettes.includes(design.palette)) return null;
  const headline = cleanLine(design.headline);
  if (headline.length === 0 || headline.length > PROMO_HEADLINE_MAX) return null;
  const subline = design.subline === undefined ? "" : cleanLine(design.subline);
  if (subline.length > PROMO_SUBLINE_MAX) return null;
  const stickers = [...new Set(design.stickers)];
  if (stickers.length > PROMO_STICKERS_MAX || !stickers.every(isStickerId)) return null;
  if (scheduleShapeProblem(promo) !== null) return null;
  return {
    design: {
      template: design.template,
      palette: design.palette,
      font: design.font,
      headline,
      subline: subline.length > 0 ? subline : undefined,
      stickers,
    },
    height: promo.height,
    startsAt: promo.startsAt,
    endsAt: promo.endsAt,
  };
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
  const { colors, buttons, banner, promo } = look.overrides;
  const overrides: StoredLook["overrides"] = {};
  if (colors) {
    const accent = normalizeHex(colors.accent);
    const background = normalizeHex(colors.background);
    if (!accent || !background) return null;
    overrides.colors = { accent, background };
  }
  if (buttons) {
    overrides.buttons = { shape: buttons.shape, fill: buttons.fill, weight: buttons.weight };
    if (buttons.design && buttons.design !== "classic") overrides.buttons.design = buttons.design;
    if (buttons.decoration) overrides.buttons.decoration = buttons.decoration;
    if (buttons.label && buttons.label !== "order") overrides.buttons.label = buttons.label;
  }
  if (banner) {
    const cleaned = cleanBanner(banner);
    if (!cleaned) return null;
    overrides.banner = cleaned;
  }
  if (promo) {
    const cleaned = cleanPromo(promo);
    if (!cleaned) return null;
    overrides.promo = cleaned;
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

/** The look without its event & promo banner (what shows when the promo isn't live). */
export function withoutPromo(look: StoredLook): StoredLook {
  if (!look.overrides.promo) return look;
  const overrides = { ...look.overrides };
  delete overrides.promo;
  return { ...look, overrides };
}

/** Same look, whatever the key order (stored docs don't keep it). */
export function sameLook(a: StoredLook | null | undefined, b: StoredLook | null | undefined): boolean {
  return JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
}
