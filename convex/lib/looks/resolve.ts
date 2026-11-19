import { bestOn, contrast, isDark, mix, type Hex } from "./color";
import { gradientCss, GRADIENTS, type ArtworkId, type BannerAlign, type BannerHeight } from "./banners";
import { PRESETS } from "./presets";
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
  | { kind: "artwork"; artworkId: ArtworkId; height: BannerHeight; text: ResolvedBannerText | null };

export type ResolvedLook<Img> = {
  preset: PresetId;
  dark: boolean;
  colors: ResolvedColors;
  buttons: ButtonsFacet;
  radius: string;
  banner: ResolvedBanner<Img>;
};

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

export function resolveLook(look: StoredLook): ResolvedLook<string> {
  const preset = PRESETS[look.preset];
  const colors = resolveColors(look);
  const banner = look.overrides.banner ?? preset.banner;
  let resolvedBanner: ResolvedBanner<string>;
  switch (banner.kind) {
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
    buttons: look.overrides.buttons ?? preset.buttons,
    radius: preset.radius,
    banner: resolvedBanner,
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
  };
}
