import { v, type Infer } from "convex/values";
import { buttonDecorationValidator, buttonDesignValidator, orderLabelValidator } from "./buttonDesigns";
import { eventFontIdValidator, eventPaletteIdValidator, eventTemplateIdValidator } from "./events";

/**
 * How a shop look is stored (CLAUDE.md "Shop looks"): a preset plus
 * optional per-facet overrides. A missing facet means "use the preset's".
 * Later phases add facets (font, background, pattern, cards, sections) as
 * new optional keys in `overrides` — old rows simply get the preset value.
 *
 * Validators check shapes; `cleanLook` (clean.ts) checks values (hex
 * format, ranges, text length).
 */

export const presetIdValidator = v.union(
  v.literal("classic"),
  v.literal("blush"),
  v.literal("lavender"),
  v.literal("emeraldGold"),
  v.literal("noir"),
  v.literal("sunset"),
  v.literal("roseGarden"),
  v.literal("ocean"),
  v.literal("kitenge"),
);
export type PresetId = Infer<typeof presetIdValidator>;

export const colorsFacetValidator = v.object({
  /** "#rrggbb" */
  accent: v.string(),
  /** "#rrggbb" */
  background: v.string(),
});
export type ColorsFacet = Infer<typeof colorsFacetValidator>;

export const buttonShapeValidator = v.union(v.literal("rounded"), v.literal("pill"), v.literal("square"));
export const buttonFillValidator = v.union(v.literal("solid"), v.literal("outline"));
export const buttonWeightValidator = v.union(v.literal("soft"), v.literal("bold"));

export const buttonsFacetValidator = v.object({
  shape: buttonShapeValidator,
  fill: buttonFillValidator,
  weight: buttonWeightValidator,
  /** Decorative design (buttonDesigns.ts); missing = classic. */
  design: v.optional(buttonDesignValidator),
  /** Decoration icon; missing = the design's own. */
  decoration: v.optional(buttonDecorationValidator),
  /** Order button wording; missing = "Order on WhatsApp". */
  label: v.optional(orderLabelValidator),
});
export type ButtonsFacet = Infer<typeof buttonsFacetValidator>;
export type ButtonShape = ButtonsFacet["shape"];
export type ButtonFill = ButtonsFacet["fill"];
export type ButtonWeight = ButtonsFacet["weight"];

export const bannerHeightValidator = v.union(v.literal("sm"), v.literal("md"), v.literal("lg"));

export const bannerTextValidator = v.object({
  value: v.string(),
  align: v.union(v.literal("start"), v.literal("center")),
});
export type BannerText = Infer<typeof bannerTextValidator>;

export const gradientIdValidator = v.union(
  v.literal("creamBlush"),
  v.literal("blushPeach"),
  v.literal("lilacMist"),
  v.literal("roseDusk"),
  v.literal("peachSunset"),
  v.literal("aquaShore"),
  v.literal("emeraldGold"),
  v.literal("noirGold"),
);

export const artworkIdValidator = v.union(
  v.literal("kitengeDiamonds"),
  v.literal("kitengeWaves"),
  v.literal("petals"),
  v.literal("goldArcs"),
  v.literal("softDots"),
);

export const bannerFacetValidator = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({
    kind: v.literal("photo"),
    imageId: v.id("_storage"),
    /** Focal point, percent of width / height. */
    focusX: v.number(),
    focusY: v.number(),
    /** 1 – 2 */
    zoom: v.number(),
    height: bannerHeightValidator,
    text: v.optional(bannerTextValidator),
  }),
  v.object({
    kind: v.literal("gradient"),
    gradientId: gradientIdValidator,
    height: bannerHeightValidator,
    text: v.optional(bannerTextValidator),
  }),
  v.object({
    kind: v.literal("artwork"),
    artworkId: artworkIdValidator,
    height: bannerHeightValidator,
    text: v.optional(bannerTextValidator),
  }),
);
export type BannerFacet = Infer<typeof bannerFacetValidator>;

/** An event & promo banner design (events.ts: templates, palettes, limits). */
export const eventDesignValidator = v.object({
  template: eventTemplateIdValidator,
  /** One of the template's palettes. */
  palette: eventPaletteIdValidator,
  font: eventFontIdValidator,
  /** 1 – PROMO_HEADLINE_MAX chars. */
  headline: v.string(),
  /** Up to PROMO_SUBLINE_MAX chars. */
  subline: v.optional(v.string()),
  /** Sticker ids from src/assets/images/stickers/manifest.ts, unique, up to PROMO_STICKERS_MAX. */
  stickers: v.array(v.string()),
});
export type EventDesign = Infer<typeof eventDesignValidator>;

/**
 * Shown instead of the normal `banner` while live (schedule.ts). Missing
 * start = from publish; missing end = until the seller removes it.
 */
export const promoFacetValidator = v.object({
  design: eventDesignValidator,
  height: bannerHeightValidator,
  startsAt: v.optional(v.number()),
  endsAt: v.optional(v.number()),
});
export type PromoFacet = Infer<typeof promoFacetValidator>;

export const lookOverridesValidator = v.object({
  colors: v.optional(colorsFacetValidator),
  buttons: v.optional(buttonsFacetValidator),
  banner: v.optional(bannerFacetValidator),
  promo: v.optional(promoFacetValidator),
});
export type LookOverrides = Infer<typeof lookOverridesValidator>;

export const storedLookValidator = v.object({
  /** Shape version, for future migrations. */
  v: v.literal(1),
  preset: presetIdValidator,
  overrides: lookOverridesValidator,
});
export type StoredLook = Infer<typeof storedLookValidator>;
