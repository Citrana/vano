import { isStickerId } from "../../../src/assets/images/stickers/manifest";
import { normalizeHex } from "./color";
import { BANNER_TEXT_MAX, FOCUS_MAX, FOCUS_MIN, ZOOM_MAX, ZOOM_MIN } from "./banners";
import { EVENT_TEMPLATES, PROMO_HEADLINE_MAX, PROMO_STICKERS_MAX, PROMO_SUBLINE_MAX } from "./events";
import { FREE_LOOK } from "./presets";
import { ANNOUNCEMENT_TEXT_MAX, cleanAnnouncementUrl, PROMO_TITLE_MAX, type AnnouncementFacet } from "./announcement";
import { cleanProfile, freeProfileOf } from "./profile";
import { scheduleShapeProblem } from "./schedule";
import { cleanSections, freeSectionsOf } from "./sections";
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
    link: promo.link,
  };
}

/**
 * Checks the Promo bar: optional one-line text (empty = sale-only), an
 * https link, the optional sale title, custom colours as hex, the
 * schedule shape. Defaults are dropped so stored facets stay small.
 */
export function cleanAnnouncement(announcement: AnnouncementFacet): AnnouncementFacet | null {
  const text = cleanLine(announcement.text);
  if (text.length > ANNOUNCEMENT_TEXT_MAX) return null;
  let link: AnnouncementFacet["link"];
  if (announcement.link?.kind === "sale") link = { kind: "sale" };
  else if (announcement.link?.kind === "url") {
    const url = cleanAnnouncementUrl(announcement.link.url);
    if (url === null) return null;
    link = { kind: "url", url };
  }
  if (scheduleShapeProblem(announcement) !== null) return null;
  const cleaned: AnnouncementFacet = { text, link, tone: announcement.tone, startsAt: announcement.startsAt, endsAt: announcement.endsAt };
  if (announcement.style && announcement.style !== "solid") cleaned.style = announcement.style;
  if (announcement.colors) {
    const background = normalizeHex(announcement.colors.background);
    const foreground = normalizeHex(announcement.colors.foreground);
    if (!background || !foreground) return null;
    cleaned.colors = { background, foreground };
  }
  if (announcement.icon && announcement.icon !== "none") cleaned.icon = announcement.icon;
  if (announcement.title !== undefined) {
    const title = cleanLine(announcement.title);
    if (title.length > PROMO_TITLE_MAX) return null;
    if (title.length > 0) cleaned.title = title;
  }
  if (announcement.countdown === false) cleaned.countdown = false;
  if (announcement.closable === false) cleaned.closable = false;
  return cleaned;
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
  const { colors, buttons, banner, promo, profile, sections, announcement } = look.overrides;
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
  if (profile) {
    const cleaned = cleanProfile(profile);
    if (!cleaned) return null;
    overrides.profile = cleaned;
  }
  if (sections) {
    const cleaned = cleanSections(sections);
    if (!cleaned) return null;
    overrides.sections = cleaned;
  }
  if (announcement) {
    const cleaned = cleanAnnouncement(announcement);
    if (!cleaned) return null;
    overrides.announcement = cleaned;
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

/** The look without its announcement bar (dated, so it may not show while the rest does). */
export function withoutAnnouncement(look: StoredLook): StoredLook {
  if (!look.overrides.announcement) return look;
  const overrides = { ...look.overrides };
  delete overrides.announcement;
  return { ...look, overrides };
}

/** The look without its profile decoration (what shows when the decoration isn't live). */
export function withoutDecoration(look: StoredLook): StoredLook {
  const profile = look.overrides.profile;
  if (!profile?.decoration) return look;
  const rest = { ...profile };
  delete rest.decoration;
  return { ...look, overrides: { ...look.overrides, profile: rest } };
}

/**
 * The free look a shop shows when its plan doesn't include custom looks:
 * the free preset, plus the parts of the saved profile Free allows
 * (`freeProfileOf`). The saved design itself is never changed.
 */
export function freeLookFor(published: StoredLook): StoredLook {
  const profile = published.overrides.profile;
  return profile ? { ...FREE_LOOK, overrides: { profile: freeProfileOf(profile) } } : FREE_LOOK;
}

export type ShownFlags = {
  /** `allLooks`: preset, colours, buttons, banner, profile options. */
  entitled: boolean;
  /** The event banner is live and the plan includes `salesPromotions`. */
  promoShown: boolean;
  /** The profile decoration is live. */
  decorationShown: boolean;
  /** `featuredSections`: sections, their order and the product layout. */
  sectionsEntitled: boolean;
  /** The announcement bar is live and the plan includes `announcementBar`. */
  announcementShown: boolean;
};

/**
 * What visitors see for a published look (CLAUDE.md "Shop looks"). The
 * one rule, used by `visibleLook` on the server and by the editor's
 * "Live now" preview: no plan → the free look; the event banner only
 * while live and entitled; the profile decoration only while live; the
 * sections fall back to `freeSectionsOf` without `featuredSections`; the
 * announcement bar only while live and entitled. Each part is gated on
 * its own plan feature, so one never hides another.
 */
export function shownLook(published: StoredLook | null | undefined, flags: ShownFlags): StoredLook {
  if (!published) return FREE_LOOK;
  let look: StoredLook;
  if (!flags.entitled) look = freeLookFor(published);
  else {
    look = flags.promoShown ? published : withoutPromo(published);
    look = flags.decorationShown ? look : withoutDecoration(look);
  }
  const overrides = { ...look.overrides };
  delete overrides.sections;
  delete overrides.announcement;
  const { sections, announcement } = published.overrides;
  if (sections) overrides.sections = flags.sectionsEntitled ? sections : freeSectionsOf(sections);
  if (announcement && flags.announcementShown) overrides.announcement = announcement;
  return { ...look, overrides };
}

/** Same look, whatever the key order (stored docs don't keep it). */
export function sameLook(a: StoredLook | null | undefined, b: StoredLook | null | undefined): boolean {
  return JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
}
