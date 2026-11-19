import { v, type Infer } from "convex/values";
import type { Hex } from "./color";

/**
 * Event & promo banner templates (CLAUDE.md "Shop looks"): the data the
 * server checks and the editor offers. How each template is drawn
 * (shapes, sticker slots, text style) lives in
 * `src/features/shop-looks/events/templates/`. Names and default texts are
 * in `EventBanners.*` messages.
 *
 * Adding a template: an entry here (+ its id in `eventTemplateIdValidator`),
 * a layers file, and its EN/FR name, headline and second line. Every
 * template × palette pair is contrast-tested (looks.test.ts).
 */

export const PROMO_HEADLINE_MAX = 32;
export const PROMO_SUBLINE_MAX = 60;
export const PROMO_STICKERS_MAX = 4;

export const eventTemplateIdValidator = v.union(
  v.literal("sale"),
  v.literal("newArrivals"),
  v.literal("restocked"),
  v.literal("blackFriday"),
  v.literal("christmas"),
  v.literal("newYear"),
  v.literal("valentines"),
  v.literal("mothersDay"),
  v.literal("womensDay"),
  v.literal("eid"),
  v.literal("backToSchool"),
  v.literal("announcement"),
  v.literal("announcementBold"),
);
export type EventTemplateId = Infer<typeof eventTemplateIdValidator>;

export const eventPaletteIdValidator = v.union(
  v.literal("hotPink"),
  v.literal("blush"),
  v.literal("lilac"),
  v.literal("violetPop"),
  v.literal("plumNight"),
  v.literal("coral"),
  v.literal("peach"),
  v.literal("sunshine"),
  v.literal("gold"),
  v.literal("noirGold"),
  v.literal("ink"),
  v.literal("emerald"),
  v.literal("mint"),
  v.literal("sky"),
  v.literal("festiveRed"),
  v.literal("cream"),
);
export type EventPaletteId = Infer<typeof eventPaletteIdValidator>;

export const eventFontIdValidator = v.union(
  v.literal("modern"),
  v.literal("bold"),
  v.literal("elegant"),
  v.literal("script"),
  v.literal("display"),
);
export type EventFontId = Infer<typeof eventFontIdValidator>;
export const EVENT_FONT_IDS: readonly EventFontId[] = ["modern", "bold", "elegant", "script", "display"];

export type EventPalette = {
  /** Background gradient stops (1–3). */
  stops: readonly Hex[];
  angle: number;
  /** Decorative shapes (never behind the text area). */
  shapes: readonly [Hex, Hex];
  /** Headline colour: >= 4.5:1 on every stop (tested). */
  text: Hex;
  /** Second line colour: >= 4.5:1 on every stop (tested). */
  subText: Hex;
  /** Tint for one-colour stickers. */
  sticker: Hex;
};

export const EVENT_PALETTES: Record<EventPaletteId, EventPalette> = {
  hotPink: {
    stops: ["#cc1758", "#ad1457"],
    angle: 135,
    shapes: ["#ff80ab", "#f06292"],
    text: "#ffffff",
    subText: "#ffffff",
    sticker: "#ffe082",
  },
  blush: {
    stops: ["#ffe4ec", "#ffd1df"],
    angle: 135,
    shapes: ["#ff9fbd", "#ffffff"],
    text: "#6d1235",
    subText: "#6d1235",
    sticker: "#d81b60",
  },
  lilac: {
    stops: ["#f1e6ff", "#e0ccff"],
    angle: 135,
    shapes: ["#b388ff", "#fbf5ff"],
    text: "#3f1d73",
    subText: "#3f1d73",
    sticker: "#7c4dff",
  },
  violetPop: {
    stops: ["#6a1bd1", "#4a148c"],
    angle: 135,
    shapes: ["#ff4fa3", "#9c6bff"],
    text: "#ffffff",
    subText: "#f3e9ff",
    sticker: "#ffd23f",
  },
  plumNight: {
    stops: ["#3b0a45", "#5e1a6b"],
    angle: 140,
    shapes: ["#c2185b", "#8e3a9d"],
    text: "#ffe9f5",
    subText: "#ffe9f5",
    sticker: "#ffd166",
  },
  coral: {
    stops: ["#ff8a65", "#ff6f61"],
    angle: 120,
    shapes: ["#ffccbc", "#ff4f5e"],
    text: "#3b0d0d",
    subText: "#3b0d0d",
    sticker: "#ffffff",
  },
  peach: {
    stops: ["#ffe6d5", "#ffcdb2"],
    angle: 120,
    shapes: ["#ffab91", "#fff5ee"],
    text: "#5c1d0b",
    subText: "#5c1d0b",
    sticker: "#e64a19",
  },
  sunshine: {
    stops: ["#ffd23f", "#ffb627"],
    angle: 125,
    shapes: ["#fff3b0", "#ff8c42"],
    text: "#3a2300",
    subText: "#3a2300",
    sticker: "#d81b60",
  },
  gold: {
    stops: ["#fff3d1", "#ffe08a"],
    angle: 135,
    shapes: ["#f4c430", "#fffaf0"],
    text: "#4a3200",
    subText: "#4a3200",
    sticker: "#b8860b",
  },
  noirGold: {
    stops: ["#121012", "#2a2116"],
    angle: 135,
    shapes: ["#c9a227", "#3a2e1a"],
    text: "#f3d98b",
    subText: "#f6e7bd",
    sticker: "#e9c46a",
  },
  ink: {
    stops: ["#111111", "#262626"],
    angle: 135,
    shapes: ["#ff2e63", "#444444"],
    text: "#ffffff",
    subText: "#f2f2f2",
    sticker: "#ff2e63",
  },
  emerald: {
    stops: ["#0b5d45", "#0a3d30"],
    angle: 135,
    shapes: ["#d4af37", "#127a5c"],
    text: "#fdf6e3",
    subText: "#fdf6e3",
    sticker: "#f2d16b",
  },
  mint: {
    stops: ["#dff7ee", "#c3eedd"],
    angle: 135,
    shapes: ["#7fd8b6", "#ffffff"],
    text: "#0d4a38",
    subText: "#0d4a38",
    sticker: "#139a6e",
  },
  sky: {
    stops: ["#e3f2fd", "#c9e4fb"],
    angle: 135,
    shapes: ["#90caf9", "#ffffff"],
    text: "#0d3a63",
    subText: "#0d3a63",
    sticker: "#1e88e5",
  },
  festiveRed: {
    stops: ["#b3122e", "#7f0d21"],
    angle: 135,
    shapes: ["#e85d75", "#ffffff"],
    text: "#fff4e8",
    subText: "#fff4e8",
    sticker: "#ffd166",
  },
  cream: {
    stops: ["#fff8f3", "#fbe9df"],
    angle: 135,
    shapes: ["#f4b8a0", "#ffffff"],
    text: "#1a1412",
    subText: "#3b2f2a",
    sticker: "#d63e0f",
  },
};

export type EventTemplate = {
  category: "promo" | "season" | "celebration" | "announcement";
  /** 4–6 curated palettes; the first is the default. */
  palettes: readonly EventPaletteId[];
  defaultFont: EventFontId;
  /** Sticker ids from the sticker manifest. */
  defaultStickers: readonly string[];
};

export const EVENT_TEMPLATES: Record<EventTemplateId, EventTemplate> = {
  sale: {
    category: "promo",
    palettes: ["hotPink", "coral", "violetPop", "sunshine", "blush"],
    defaultFont: "bold",
    defaultStickers: ["percentBurst", "sparkles"],
  },
  newArrivals: {
    category: "promo",
    palettes: ["blush", "lilac", "mint", "peach", "cream"],
    defaultFont: "elegant",
    defaultStickers: ["star", "sparkles"],
  },
  restocked: {
    category: "promo",
    palettes: ["mint", "sky", "peach", "lilac", "gold"],
    defaultFont: "modern",
    defaultStickers: ["heart", "star"],
  },
  blackFriday: {
    category: "promo",
    palettes: ["ink", "noirGold", "plumNight", "festiveRed", "violetPop"],
    defaultFont: "bold",
    defaultStickers: ["percentBurst", "saleTag"],
  },
  christmas: {
    category: "season",
    palettes: ["festiveRed", "emerald", "cream", "noirGold", "sky"],
    defaultFont: "script",
    defaultStickers: ["ornament", "star"],
  },
  newYear: {
    category: "season",
    palettes: ["noirGold", "plumNight", "ink", "violetPop", "gold"],
    defaultFont: "display",
    defaultStickers: ["sparkles", "confetti"],
  },
  valentines: {
    category: "celebration",
    palettes: ["hotPink", "blush", "festiveRed", "plumNight", "lilac"],
    defaultFont: "script",
    defaultStickers: ["heart", "sparkles"],
  },
  mothersDay: {
    category: "celebration",
    palettes: ["blush", "peach", "lilac", "gold", "mint"],
    defaultFont: "elegant",
    defaultStickers: ["flower", "heart"],
  },
  womensDay: {
    category: "celebration",
    palettes: ["violetPop", "lilac", "hotPink", "plumNight", "coral"],
    defaultFont: "display",
    defaultStickers: ["flower", "star"],
  },
  eid: {
    category: "celebration",
    palettes: ["emerald", "noirGold", "gold", "plumNight", "sky"],
    defaultFont: "display",
    defaultStickers: ["crescent", "star"],
  },
  backToSchool: {
    category: "season",
    palettes: ["sunshine", "sky", "mint", "coral", "violetPop"],
    defaultFont: "modern",
    defaultStickers: ["pencil", "star"],
  },
  announcement: {
    category: "announcement",
    palettes: ["cream", "ink", "blush", "sky", "gold"],
    defaultFont: "modern",
    defaultStickers: [],
  },
  announcementBold: {
    category: "announcement",
    palettes: ["violetPop", "hotPink", "ink", "emerald", "coral"],
    defaultFont: "bold",
    defaultStickers: ["sparkles"],
  },
};

/** Display order in the editor's template grid. */
export const EVENT_TEMPLATE_IDS: readonly EventTemplateId[] = [
  "sale",
  "newArrivals",
  "restocked",
  "blackFriday",
  "christmas",
  "newYear",
  "valentines",
  "mothersDay",
  "womensDay",
  "eid",
  "backToSchool",
  "announcement",
  "announcementBold",
];

export function eventPaletteCss(palette: EventPalette): string {
  return palette.stops.length === 1
    ? palette.stops[0]
    : `linear-gradient(${palette.angle}deg, ${palette.stops.join(", ")})`;
}
