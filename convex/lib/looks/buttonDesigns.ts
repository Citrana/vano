import { v, type Infer } from "convex/values";

/**
 * Decorative button designs (CLAUDE.md "Shop looks"): optional fields of
 * the buttons facet. The look is drawn in CSS (`globals.css`, the
 * `data-btn-design` / `data-btn-deco` rules); decoration icons reuse the
 * original sticker SVGs. Names in `LookEditor.buttons.*`, order labels in
 * `Public.orderLabels.*`.
 */

export const buttonDesignValidator = v.union(
  v.literal("classic"),
  v.literal("floral"),
  v.literal("sparkle"),
  v.literal("heart"),
  v.literal("bow"),
  v.literal("scalloped"),
  v.literal("sticker"),
  v.literal("glow"),
);
export type ButtonDesign = Infer<typeof buttonDesignValidator>;
export const BUTTON_DESIGNS: readonly ButtonDesign[] = [
  "classic",
  "floral",
  "sparkle",
  "heart",
  "bow",
  "scalloped",
  "sticker",
  "glow",
];

export const buttonDecorationValidator = v.union(
  v.literal("none"),
  v.literal("flower"),
  v.literal("heart"),
  v.literal("star"),
  v.literal("bow"),
  v.literal("sparkle"),
);
export type ButtonDecoration = Infer<typeof buttonDecorationValidator>;
export const BUTTON_DECORATIONS: readonly ButtonDecoration[] = ["none", "flower", "heart", "star", "bow", "sparkle"];

/** The icon a design shows unless the seller picks another (or none). */
export const DESIGN_DECORATION: Record<ButtonDesign, ButtonDecoration> = {
  classic: "none",
  floral: "flower",
  sparkle: "sparkle",
  heart: "heart",
  bow: "bow",
  scalloped: "none",
  sticker: "none",
  glow: "none",
};

export const orderLabelValidator = v.union(v.literal("order"), v.literal("want"), v.literal("orderNow"));
export type OrderLabel = Infer<typeof orderLabelValidator>;
export const ORDER_LABELS: readonly OrderLabel[] = ["order", "want", "orderNow"];
