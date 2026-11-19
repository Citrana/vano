import type { Hex } from "./color";

/**
 * Curated banner options (CLAUDE.md "Shop looks"). Gradients are pure CSS
 * with a fixed text colour (tested against every stop); artworks are
 * original SVGs in `src/assets/images/patterns/banners/` (text over them
 * sits on a scrim, like photos).
 */

export const BANNER_HEIGHTS = ["sm", "md", "lg"] as const;
export type BannerHeight = (typeof BANNER_HEIGHTS)[number];

export const BANNER_TEXT_MAX = 60;
export const BANNER_ALIGNS = ["start", "center"] as const;
export type BannerAlign = (typeof BANNER_ALIGNS)[number];

/** Focal point (percent) and zoom limits for a banner photo. */
export const FOCUS_MIN = 0;
export const FOCUS_MAX = 100;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 2;

export const GRADIENT_IDS = [
  "creamBlush",
  "blushPeach",
  "lilacMist",
  "roseDusk",
  "peachSunset",
  "aquaShore",
  "emeraldGold",
  "noirGold",
] as const;
export type GradientId = (typeof GRADIENT_IDS)[number];

export const GRADIENTS: Record<GradientId, { stops: readonly Hex[]; angle: number; text: Hex }> = {
  creamBlush: { stops: ["#fff8f3", "#ffe3d6"], angle: 135, text: "#1a1412" },
  blushPeach: { stops: ["#ffe4ea", "#ffd9c7"], angle: 120, text: "#3a1424" },
  lilacMist: { stops: ["#efe7ff", "#fbe4f3"], angle: 135, text: "#2e1a52" },
  roseDusk: { stops: ["#f9d5dc", "#e8c5e0"], angle: 160, text: "#3a1230" },
  peachSunset: { stops: ["#ffd8b8", "#ffb7a1", "#f7a1c4"], angle: 110, text: "#3b1020" },
  aquaShore: { stops: ["#dff3f5", "#cde8f2"], angle: 135, text: "#0d3640" },
  emeraldGold: { stops: ["#0b4a37", "#6b5317"], angle: 120, text: "#fbf3dc" },
  noirGold: { stops: ["#141113", "#2a2116"], angle: 135, text: "#f3dfa6" },
};

export function gradientCss(id: GradientId): string {
  const { stops, angle } = GRADIENTS[id];
  return `linear-gradient(${angle}deg, ${stops.join(", ")})`;
}

export const ARTWORK_IDS = ["kitengeDiamonds", "kitengeWaves", "petals", "goldArcs", "softDots"] as const;
export type ArtworkId = (typeof ARTWORK_IDS)[number];

/** The artwork's main colour (swatch / placeholder while it loads). */
export const ARTWORK_BASE: Record<ArtworkId, Hex> = {
  kitengeDiamonds: "#f6e3c4",
  kitengeWaves: "#1f2f5c",
  petals: "#fbe3e4",
  goldArcs: "#141113",
  softDots: "#fff1f3",
};
