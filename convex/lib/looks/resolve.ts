import { bestOn, contrast, isDark, mix, type Hex } from "./color";
import { gradientCss, GRADIENTS, type ArtworkId, type BannerAlign, type BannerHeight } from "./banners";
import { DESIGN_DECORATION, type ButtonDecoration, type ButtonDesign, type OrderLabel } from "./buttonDesigns";
import { EVENT_PALETTES, type EventFontId, type EventPalette, type EventPaletteId, type EventTemplateId } from "./events";
import type { AnnouncementFacet, AnnouncementLink, AnnouncementTone } from "./announcement";
import { PRESETS } from "./presets";
import { sectionsOf, type SectionsFacet } from "./sections";
import {
  BORDER_UNITS,
  DEFAULT_PROFILE,
  type ProfileBorderStyle,
  type ProfileColorToken,
  type ProfileCorner,
  type ProfileDecorationId,
  type ProfileFacet,
  type ProfileOverlap,
  type ProfilePosition,
  type ProfileShape,
  type ProfileSize,
} from "./profile";
import type { ButtonShape, ButtonsFacet, PresetId, StoredLook } from "./validators";

/**
 * Turns a stored look into what the page applies (CLAUDE.md "Shop looks"):
 * semantic CSS variables (the same tokens the old `[data-shop-theme]`
 * blocks re-mapped), the button style and a banner descriptor. Pure; the
 * same everywhere (public pages, editor preview, marketing, admin).
 *
 * Text colours are derived, never picked: the foreground is ink or cream,
 * whichever contrasts more with the background, and muted text is mixed
 * toward it until it reaches 4.5:1 on every surface.
 */

export const INK: Hex = "#1a1412";
export const CREAM: Hex = "#fff8f3";
export const WHITE: Hex = "#ffffff";

export const BUTTON_RADIUS: Record<ButtonShape, string> = {
  rounded: "0.625rem",
  pill: "9999px",
  square: "0.25rem",
};

export type ResolvedColors = {
  background: Hex;
  foreground: Hex;
  card: Hex;
  muted: Hex;
  mutedForeground: Hex;
  border: Hex;
  input: Hex;
  primary: Hex;
  primaryForeground: Hex;
  /** Selected chips and badges (bold fill). */
  chip: Hex;
  chipForeground: Hex;
  /** Soft fill: a tint of the chip colour with readable chip-coloured text. */
  chipSoft: Hex;
  chipSoftForeground: Hex;
  /** Prices: the accent when it's readable as text, else the foreground. */
  price: Hex;
};

export type ResolvedBannerText = { value: string; align: BannerAlign };

/** `Img` is the storage id on the server and a URL once public. */
export type ResolvedBanner<Img> =
  | { kind: "none" }
  | { kind: "photo"; image: Img; focusX: number; focusY: number; zoom: number; height: BannerHeight; text: ResolvedBannerText | null }
  | { kind: "gradient"; css: string; textColor: Hex; height: BannerHeight; text: ResolvedBannerText | null }
  | { kind: "artwork"; artworkId: ArtworkId; height: BannerHeight; text: ResolvedBannerText | null }
  | ResolvedEventBanner;

/** An event & promo banner, ready to draw (palette colours included). */
export type ResolvedEventBanner = {
  kind: "event";
  template: EventTemplateId;
  paletteId: EventPaletteId;
  palette: EventPalette;
  font: EventFontId;
  headline: string;
  subline: string | null;
  stickers: readonly string[];
  height: BannerHeight;
  /** Links to the shop's sale items while a sale runs (`promo.link`). */
  link?: "sale";
};

/** The buttons facet with every default filled in. */
export type ResolvedButtons = Pick<ButtonsFacet, "shape" | "fill" | "weight"> & {
  design: ButtonDesign;
  /** The icon shown (the seller's pick, else the design's own). */
  decoration: ButtonDecoration;
  label: OrderLabel;
};

export function resolveButtons(buttons: ButtonsFacet): ResolvedButtons {
  const design = buttons.design ?? "classic";
  return {
    shape: buttons.shape,
    fill: buttons.fill,
    weight: buttons.weight,
    design,
    decoration: buttons.decoration ?? DESIGN_DECORATION[design],
    label: buttons.label ?? "order",
  };
}

/**
 * The Glow design's gradient for a colour and its label: the colour on
 * top, then a tone that moves away from the label (darker under white
 * text, lighter under ink), so the label only gains contrast. The shine is
 * a thin highlight at the top edge (CSS), never behind the text.
 * `contrast.ts` checks the label on both stops.
 */
export function glowStops(color: Hex, label: Hex): [Hex, Hex] {
  const deeper = label === WHITE ? mix(color, "#000000", 0.16) : mix(color, WHITE, 0.22);
  return [color, deeper];
}

/** The profile photo, ready to draw (profile.ts; drawn by `ProfileAvatar`). */
export type ResolvedProfile = {
  shape: ProfileShape;
  size: ProfileSize;
  position: ProfilePosition;
  overlap: ProfileOverlap;
  corner: ProfileCorner;
  /**
   * Null = no border. `units` = band width in photo-box units (0–100).
   * `token` = a shop colour (drawn with its CSS variable, so it follows the
   * look scope); `color` is its value here, for the contrast check.
   */
  border: { units: number; style: ProfileBorderStyle; color: Hex; token: ProfileColorToken | null } | null;
  decoration: ProfileDecorationId | null;
  /** The ring between the photo and the banner (the page background). */
  halo: Hex;
  /** No photo: the shop's first letter on the chip colour (contrast-safe pair). */
  initialBg: Hex;
  initialFg: Hex;
};

/** The announcement bar, ready to draw: its fill and derived text colour. */
export type ResolvedAnnouncement = {
  text: string;
  link: AnnouncementLink | null;
  tone: AnnouncementTone;
  background: Hex;
  foreground: Hex;
};

export type ResolvedLook<Img> = {
  preset: PresetId;
  dark: boolean;
  colors: ResolvedColors;
  buttons: ResolvedButtons;
  radius: string;
  banner: ResolvedBanner<Img>;
  profile: ResolvedProfile;
  /** The sections, their order and the product layout (default filled in). */
  sections: SectionsFacet;
  /** Null = no announcement bar (none, or not live / not in the plan: `shownLook`). */
  announcement: ResolvedAnnouncement | null;
};

/** The announcement bar's colours: shop colours only, the text colour derived. */
export function resolveAnnouncement(announcement: AnnouncementFacet | undefined, colors: ResolvedColors): ResolvedAnnouncement | null {
  if (!announcement) return null;
  const [background, foreground]: [Hex, Hex] =
    announcement.tone === "accent"
      ? [colors.primary, colors.primaryForeground]
      : announcement.tone === "dark"
        ? [colors.foreground, colors.background]
        : [colors.chipSoft, colors.chipSoftForeground];
  return { text: announcement.text, link: announcement.link ?? null, tone: announcement.tone, background, foreground };
}

/** A profile facet with the look's colours applied. Theme border colours follow the look. */
export function resolveProfile(profile: ProfileFacet | undefined, colors: ResolvedColors): ResolvedProfile {
  const p = profile ?? DEFAULT_PROFILE;
  const color: Hex =
    p.borderColor.kind === "custom"
      ? (p.borderColor.hex as Hex)
      : p.borderColor.token === "accent"
        ? colors.primary
        : p.borderColor.token === "chip"
          ? colors.chip
          : colors.foreground;
  return {
    shape: p.shape,
    size: p.size,
    position: p.position,
    overlap: p.overlap,
    corner: p.corner,
    border:
      p.borderWidth === "none"
        ? null
        : {
            units: BORDER_UNITS[p.borderWidth],
            style: p.borderStyle,
            color,
            token: p.borderColor.kind === "theme" ? p.borderColor.token : null,
          },
    decoration: p.decoration?.id ?? null,
    halo: colors.background,
    initialBg: colors.chip,
    initialFg: colors.chipForeground,
  };
}

/** Mixes `from` toward `to` until it reaches `target` contrast on every surface. */
function readableOn(from: Hex, to: Hex, surfaces: readonly Hex[], target: number): Hex {
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(from, to, step / 20);
    if (surfaces.every((s) => contrast(candidate, s) >= target)) return candidate;
  }
  return to;
}

export function resolveColors(look: StoredLook): ResolvedColors {
  const preset = PRESETS[look.preset];
  const custom = look.overrides.colors;
  const accent = (custom?.accent ?? preset.colors.accent) as Hex;
  const background = (custom?.background ?? preset.colors.background) as Hex;
  const dark = isDark(background);
  const foreground = bestOn(background, [INK, CREAM]);

  const card = custom ? (dark ? mix(background, WHITE, 0.07) : WHITE) : (preset.colors.card ?? (dark ? mix(background, WHITE, 0.07) : WHITE));
  const muted = mix(background, foreground, dark ? 0.12 : 0.05);
  const border = mix(background, foreground, dark ? 0.18 : 0.12);
  const input = mix(background, foreground, dark ? 0.24 : 0.16);
  const mutedForeground = readableOn(mix(background, foreground, 0.6), foreground, [background, card, muted], 4.5);
  const chip = custom ? accent : ((preset.colors.badge ?? accent) as Hex);
  const chipSoft = mix(background, chip, dark ? 0.24 : 0.12);

  return {
    background,
    foreground,
    card,
    muted,
    mutedForeground,
    border,
    input,
    primary: accent,
    primaryForeground: bestOn(accent, [WHITE, INK]),
    chip,
    chipForeground: bestOn(chip, [WHITE, INK]),
    chipSoft,
    chipSoftForeground: readableOn(chip, foreground, [chipSoft], 4.5),
    price: contrast(accent, background) >= 4.5 && contrast(accent, card) >= 4.5 ? accent : foreground,
  };
}

function cleanText(text: { value: string; align: BannerAlign } | undefined): ResolvedBannerText | null {
  return text && text.value.length > 0 ? { value: text.value, align: text.align } : null;
}

/**
 * A look's event & promo banner (`overrides.promo`) wins over its normal
 * banner. Callers strip the promo (`withoutPromo`) when it isn't live or
 * the plan doesn't show it (store.ts `visibleLook`).
 */
export function resolveLook(look: StoredLook): ResolvedLook<string> {
  const preset = PRESETS[look.preset];
  const colors = resolveColors(look);
  const banner = look.overrides.banner ?? preset.banner;
  const promo = look.overrides.promo;
  let resolvedBanner: ResolvedBanner<string>;
  if (promo) {
    resolvedBanner = {
      kind: "event",
      template: promo.design.template,
      paletteId: promo.design.palette,
      palette: EVENT_PALETTES[promo.design.palette],
      font: promo.design.font,
      headline: promo.design.headline,
      subline: promo.design.subline ?? null,
      stickers: promo.design.stickers,
      height: promo.height,
      link: promo.link,
    };
  } else switch (banner.kind) {
    case "none":
      resolvedBanner = { kind: "none" };
      break;
    case "photo":
      resolvedBanner = {
        kind: "photo",
        image: banner.imageId,
        focusX: banner.focusX,
        focusY: banner.focusY,
        zoom: banner.zoom,
        height: banner.height,
        text: cleanText(banner.text),
      };
      break;
    case "gradient":
      resolvedBanner = {
        kind: "gradient",
        css: gradientCss(banner.gradientId),
        textColor: GRADIENTS[banner.gradientId].text,
        height: banner.height,
        text: cleanText(banner.text),
      };
      break;
    case "artwork":
      resolvedBanner = { kind: "artwork", artworkId: banner.artworkId, height: banner.height, text: cleanText(banner.text) };
      break;
  }
  return {
    preset: look.preset,
    dark: isDark(colors.background),
    colors,
    buttons: resolveButtons(look.overrides.buttons ?? preset.buttons),
    radius: preset.radius,
    banner: resolvedBanner,
    profile: resolveProfile(look.overrides.profile, colors),
    sections: sectionsOf(look.overrides.sections),
    announcement: resolveAnnouncement(look.overrides.announcement, colors),
  };
}

/** Swaps the banner photo reference (storage id → URL). A missing URL hides the banner. */
export function mapBannerImage<A, B>(look: ResolvedLook<A>, toB: (a: A) => B | null): ResolvedLook<B> {
  const { banner } = look;
  if (banner.kind !== "photo") return { ...look, banner };
  const image = toB(banner.image);
  return { ...look, banner: image === null ? { kind: "none" } : { ...banner, image } };
}

/** The CSS variables a look scope sets (semantic shadcn tokens + button radius). */
export function lookCssVars(look: Pick<ResolvedLook<unknown>, "colors" | "buttons" | "radius">): Record<string, string> {
  const c = look.colors;
  return {
    "--background": c.background,
    "--foreground": c.foreground,
    "--card": c.card,
    "--card-foreground": c.foreground,
    "--popover": c.card,
    "--popover-foreground": c.foreground,
    "--muted": c.muted,
    "--muted-foreground": c.mutedForeground,
    "--secondary": c.muted,
    "--secondary-foreground": c.foreground,
    "--accent": c.muted,
    "--accent-foreground": c.foreground,
    "--border": c.border,
    "--input": c.input,
    "--primary": c.primary,
    "--primary-foreground": c.primaryForeground,
    "--ring": c.primary,
    "--chip": c.chip,
    "--chip-foreground": c.chipForeground,
    "--chip-soft": c.chipSoft,
    "--chip-soft-foreground": c.chipSoftForeground,
    "--shop-price": c.price,
    "--radius": look.radius,
    "--shop-btn-radius": BUTTON_RADIUS[look.buttons.shape],
    "--shop-btn-weight": look.buttons.weight === "bold" ? "650" : "500",
    ...(look.buttons.design === "glow"
      ? (() => {
          const [pFrom, pTo] = glowStops(c.primary, c.primaryForeground);
          const [cFrom, cTo] = glowStops(c.chip, c.chipForeground);
          return { "--shop-glow-from": pFrom, "--shop-glow-to": pTo, "--shop-chip-glow-from": cFrom, "--shop-chip-glow-to": cTo };
        })()
      : {}),
  };
}
