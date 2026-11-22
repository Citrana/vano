import type { Hex } from "./color";
import { isFreeProfile } from "./profile";
import type { BannerFacet, ButtonsFacet, PresetId, StoredLook } from "./validators";

/**
 * Ready-made shop looks (CLAUDE.md "Shop looks"). One list for the seller
 * editor, the public pages, the landing phone, the Features page and the
 * demo shop. Names are translated (`ShopLooks.presets.<id>`).
 *
 * Every preset passes the contrast check with zero warnings (tested).
 * `classic` is the free look (today's default Vano look); the others need
 * the `allLooks` plan feature.
 */

export const PRESET_IDS = [
  "classic",
  "blush",
  "lavender",
  "emeraldGold",
  "noir",
  "sunset",
  "roseGarden",
  "ocean",
  "kitenge",
] as const satisfies readonly PresetId[];

export type Preset = {
  id: PresetId;
  colors: {
    accent: Hex;
    background: Hex;
    /** Card surface when the preset's colours are used (default: derived). */
    card?: Hex;
    /** Selected chips and badges when the preset's colours are used (default: accent). */
    badge?: Hex;
  };
  buttons: ButtonsFacet;
  banner: BannerFacet;
  /** Corner radius of tiles and cards (a future "cards" facet will override it). */
  radius: string;
};

export const FREE_PRESET: PresetId = "classic";

export const PRESETS: Record<PresetId, Preset> = {
  classic: {
    id: "classic",
    colors: { accent: "#d63e0f", background: "#fff8f3", badge: "#1a1412" },
    buttons: { shape: "square", fill: "solid", weight: "bold" },
    banner: { kind: "gradient", gradientId: "creamBlush", height: "sm" },
    radius: "0.5rem",
  },
  blush: {
    id: "blush",
    colors: { accent: "#b83260", background: "#fff1f3" },
    buttons: { shape: "pill", fill: "solid", weight: "soft" },
    banner: { kind: "gradient", gradientId: "blushPeach", height: "md" },
    radius: "1.25rem",
  },
  lavender: {
    id: "lavender",
    colors: { accent: "#6b46c1", background: "#f6f2ff" },
    buttons: { shape: "pill", fill: "outline", weight: "soft" },
    banner: { kind: "gradient", gradientId: "lilacMist", height: "md" },
    radius: "1.25rem",
  },
  emeraldGold: {
    id: "emeraldGold",
    colors: { accent: "#0f5e46", background: "#fbf8ef", badge: "#7a5a12" },
    buttons: { shape: "rounded", fill: "solid", weight: "bold" },
    banner: { kind: "gradient", gradientId: "emeraldGold", height: "md" },
    radius: "0.75rem",
  },
  noir: {
    id: "noir",
    colors: { accent: "#e9c46a", background: "#141113", card: "#221d20" },
    buttons: { shape: "square", fill: "solid", weight: "bold" },
    banner: { kind: "artwork", artworkId: "goldArcs", height: "md" },
    radius: "0.375rem",
  },
  sunset: {
    id: "sunset",
    colors: { accent: "#c2410c", background: "#fff6ef" },
    buttons: { shape: "pill", fill: "solid", weight: "bold" },
    banner: { kind: "gradient", gradientId: "peachSunset", height: "lg" },
    radius: "1rem",
  },
  roseGarden: {
    id: "roseGarden",
    colors: { accent: "#9f1d4a", background: "#fdf4f2", badge: "#4f6b55" },
    buttons: { shape: "rounded", fill: "outline", weight: "soft" },
    banner: { kind: "artwork", artworkId: "petals", height: "md" },
    radius: "1rem",
  },
  ocean: {
    id: "ocean",
    colors: { accent: "#0e6e85", background: "#f1f8fa" },
    buttons: { shape: "rounded", fill: "solid", weight: "soft" },
    banner: { kind: "gradient", gradientId: "aquaShore", height: "md" },
    radius: "0.875rem",
  },
  kitenge: {
    id: "kitenge",
    colors: { accent: "#a3351c", background: "#fff9ef", badge: "#24346b" },
    buttons: { shape: "square", fill: "solid", weight: "bold" },
    banner: { kind: "artwork", artworkId: "kitengeDiamonds", height: "md" },
    radius: "0.375rem",
  },
};

export function presetLook(preset: PresetId): StoredLook {
  return { v: 1, preset, overrides: {} };
}

/** What a shop shows when it has no published look, or isn't entitled to its own. */
export const FREE_LOOK: StoredLook = presetLook(FREE_PRESET);

/** The free look: the free preset with nothing changed but a Free profile (`isFreeProfile`). */
export function isFreeLook(look: StoredLook): boolean {
  const { colors, buttons, banner, profile } = look.overrides;
  return look.preset === FREE_PRESET && !colors && !buttons && !banner && (!profile || isFreeProfile(profile));
}

/** Curated accent swatches: each has >= 4.5:1 with white or ink (tested). */
export const ACCENT_SWATCHES = [
  "#d63e0f",
  "#b83260",
  "#9f1d4a",
  "#5b1f4a",
  "#6b46c1",
  "#0e6e85",
  "#0f5e46",
  "#a3351c",
  "#7a5a12",
  "#1a1412",
  "#e9c46a",
  "#f2a6b8",
] as const satisfies readonly Hex[];

/** Curated backgrounds: 6 light tints, 2 dark. */
export const BACKGROUND_SWATCHES = [
  "#fff8f3",
  "#fff1f3",
  "#f6f2ff",
  "#fbf8ef",
  "#f0f7f2",
  "#f1f8fa",
  "#141113",
  "#151a2b",
] as const satisfies readonly Hex[];
