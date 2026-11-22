import { v, type Infer } from "convex/values";
import { normalizeHex } from "./color";
import type { EventTemplateId } from "./events";
import { scheduleShapeProblem } from "./schedule";

/**
 * The shop's profile photo (CLAUDE.md "Shop looks" → "Profile"): the
 * optional `profile` facet of a look. Shape, border, size, position,
 * overlap, corner decoration and one optional decoration (crown, event,
 * everyday) that can be scheduled. Pure data + rules: the server checks
 * values with `cleanProfile`; how each shape and decoration is drawn lives
 * in `src/features/shop-looks/profile/`. Names in `LookEditor.profile.*`
 * and `ProfileDecorations.*`.
 *
 * Free plan: `isFreeProfile` (circle, thin or no border, solid, a shop
 * colour). Everything else needs the `allLooks` plan feature to publish.
 */

export const profileShapeValidator = v.union(
  v.literal("circle"),
  v.literal("rounded"),
  v.literal("squircle"),
  v.literal("flower"),
  v.literal("arch"),
);
export type ProfileShape = Infer<typeof profileShapeValidator>;
export const PROFILE_SHAPES: readonly ProfileShape[] = ["circle", "rounded", "squircle", "flower", "arch"];

export const profileBorderWidthValidator = v.union(v.literal("none"), v.literal("thin"), v.literal("medium"), v.literal("thick"));
export type ProfileBorderWidth = Infer<typeof profileBorderWidthValidator>;
export const PROFILE_BORDER_WIDTHS: readonly ProfileBorderWidth[] = ["none", "thin", "medium", "thick"];

export const profileBorderStyleValidator = v.union(v.literal("solid"), v.literal("double"), v.literal("dashed"), v.literal("glow"));
export type ProfileBorderStyle = Infer<typeof profileBorderStyleValidator>;
export const PROFILE_BORDER_STYLES: readonly ProfileBorderStyle[] = ["solid", "double", "dashed", "glow"];

export const profileSizeValidator = v.union(v.literal("sm"), v.literal("md"), v.literal("lg"));
export type ProfileSize = Infer<typeof profileSizeValidator>;
export const PROFILE_SIZES: readonly ProfileSize[] = ["sm", "md", "lg"];

export const profilePositionValidator = v.union(v.literal("start"), v.literal("center"));
export type ProfilePosition = Infer<typeof profilePositionValidator>;

/** "edge": pulled up over the banner's bottom edge; "below": fully under it. */
export const profileOverlapValidator = v.union(v.literal("edge"), v.literal("below"));
export type ProfileOverlap = Infer<typeof profileOverlapValidator>;

export const profileCornerValidator = v.union(v.literal("none"), v.literal("sparkle"), v.literal("flower"), v.literal("heart"));
export type ProfileCorner = Infer<typeof profileCornerValidator>;
export const PROFILE_CORNERS: readonly ProfileCorner[] = ["none", "sparkle", "flower", "heart"];

/** A shop colour (follows the look) — the "match my shop colors" shortcut is `accent`. */
export const profileColorTokenValidator = v.union(v.literal("accent"), v.literal("chip"), v.literal("foreground"));
export type ProfileColorToken = Infer<typeof profileColorTokenValidator>;
export const PROFILE_COLOR_TOKENS: readonly ProfileColorToken[] = ["accent", "chip", "foreground"];

export const profileBorderColorValidator = v.union(
  v.object({ kind: v.literal("theme"), token: profileColorTokenValidator }),
  /** "#rrggbb" */
  v.object({ kind: v.literal("custom"), hex: v.string() }),
);
export type ProfileBorderColor = Infer<typeof profileBorderColorValidator>;

export const profileDecorationIdValidator = v.union(
  // Crowns
  v.literal("goldCrown"),
  v.literal("tiara"),
  v.literal("flowerCrown"),
  v.literal("queen"),
  v.literal("bossLady"),
  // Events
  v.literal("santaHat"),
  v.literal("hearts"),
  v.literal("crescentStars"),
  v.literal("eventFlowers"),
  v.literal("newYearSparkles"),
  v.literal("saleTag"),
  v.literal("pencil"),
  v.literal("backpack"),
  v.literal("spookyHat"),
  // Everyday
  v.literal("sparkles"),
  v.literal("bow"),
  v.literal("butterflies"),
  v.literal("floralWreath"),
  v.literal("newSticker"),
  v.literal("saleSticker"),
);
export type ProfileDecorationId = Infer<typeof profileDecorationIdValidator>;

/** Missing start = from publish; missing end = until the seller removes it (schedule.ts rules). */
export const profileDecorationValidator = v.object({
  id: profileDecorationIdValidator,
  startsAt: v.optional(v.number()),
  endsAt: v.optional(v.number()),
});
export type ProfileDecoration = Infer<typeof profileDecorationValidator>;

export const profileFacetValidator = v.object({
  shape: profileShapeValidator,
  borderWidth: profileBorderWidthValidator,
  borderStyle: profileBorderStyleValidator,
  borderColor: profileBorderColorValidator,
  size: profileSizeValidator,
  position: profilePositionValidator,
  overlap: profileOverlapValidator,
  corner: profileCornerValidator,
  decoration: v.optional(profileDecorationValidator),
});
export type ProfileFacet = Infer<typeof profileFacetValidator>;

/** Today's profile photo: what a look without a `profile` facet shows. */
export const DEFAULT_PROFILE: ProfileFacet = {
  shape: "circle",
  borderWidth: "thin",
  borderStyle: "solid",
  borderColor: { kind: "theme", token: "accent" },
  size: "md",
  position: "start",
  overlap: "edge",
  corner: "none",
};

// ---------------------------------------------------------------------------
// Decorations

export type DecorationCategory = "crown" | "event" | "everyday";
export const DECORATION_CATEGORIES: readonly DecorationCategory[] = ["crown", "event", "everyday"];

/**
 * Where a decoration sits around the photo: `top` (centred on the top
 * edge), `topSide` (tilted on the top-left), `side` (top-right cluster),
 * `badge` (a ribbon across the bottom), `sticker` (bottom-left),
 * `ring` (along the lower edge, outside the face).
 */
export type DecorationAnchor = "top" | "topSide" | "side" | "badge" | "sticker" | "ring";

export type DecorationEntry = {
  id: ProfileDecorationId;
  category: DecorationCategory;
  anchor: DecorationAnchor;
  /** Height / width of the artwork. */
  aspect: number;
  /** Event banner templates it matches (one-tap suggestion in the editor). */
  events: readonly EventTemplateId[];
  /** A gentle animation, only under `prefers-reduced-motion: no-preference`. */
  motion?: "twinkle" | "sway";
};

export const PROFILE_DECORATIONS: readonly DecorationEntry[] = [
  { id: "goldCrown", category: "crown", anchor: "top", aspect: 0.62, events: [], motion: "twinkle" },
  { id: "tiara", category: "crown", anchor: "top", aspect: 0.5, events: [], motion: "twinkle" },
  { id: "flowerCrown", category: "crown", anchor: "top", aspect: 0.42, events: [] },
  { id: "queen", category: "crown", anchor: "badge", aspect: 0.34, events: [] },
  { id: "bossLady", category: "crown", anchor: "badge", aspect: 0.34, events: [] },
  { id: "santaHat", category: "event", anchor: "topSide", aspect: 0.8, events: ["christmas"] },
  { id: "hearts", category: "event", anchor: "side", aspect: 1, events: ["valentines"], motion: "sway" },
  { id: "crescentStars", category: "event", anchor: "side", aspect: 1, events: ["eid"], motion: "twinkle" },
  { id: "eventFlowers", category: "event", anchor: "side", aspect: 1, events: ["mothersDay", "womensDay"], motion: "sway" },
  { id: "newYearSparkles", category: "event", anchor: "side", aspect: 1, events: ["newYear"], motion: "twinkle" },
  { id: "saleTag", category: "event", anchor: "sticker", aspect: 1, events: ["blackFriday"] },
  { id: "pencil", category: "event", anchor: "side", aspect: 1, events: [] },
  { id: "backpack", category: "event", anchor: "sticker", aspect: 1, events: ["backToSchool"] },
  { id: "spookyHat", category: "event", anchor: "topSide", aspect: 0.8, events: [] },
  { id: "sparkles", category: "everyday", anchor: "side", aspect: 1, events: [], motion: "twinkle" },
  { id: "bow", category: "everyday", anchor: "side", aspect: 0.72, events: [] },
  { id: "butterflies", category: "everyday", anchor: "side", aspect: 1, events: [], motion: "sway" },
  { id: "floralWreath", category: "everyday", anchor: "ring", aspect: 1, events: [] },
  { id: "newSticker", category: "everyday", anchor: "sticker", aspect: 1, events: ["newArrivals"] },
  { id: "saleSticker", category: "everyday", anchor: "sticker", aspect: 1, events: ["sale"] },
];

export const PROFILE_DECORATION_IDS: readonly ProfileDecorationId[] = PROFILE_DECORATIONS.map((d) => d.id);

export function decorationEntry(id: ProfileDecorationId): DecorationEntry {
  return PROFILE_DECORATIONS.find((d) => d.id === id)!;
}

/** The decoration that matches an event banner template, if any (a suggestion, never applied by itself). */
export function decorationForTemplate(template: EventTemplateId): ProfileDecorationId | null {
  return PROFILE_DECORATIONS.find((d) => d.events.includes(template))?.id ?? null;
}

// ---------------------------------------------------------------------------
// Plans

/** What the Free plan can publish: circle, thin or no border, solid, a shop colour, nothing else changed. */
export function isFreeProfile(p: ProfileFacet): boolean {
  return (
    p.shape === "circle" &&
    (p.borderWidth === "thin" || p.borderWidth === "none") &&
    p.borderStyle === "solid" &&
    p.borderColor.kind === "theme" &&
    p.size === DEFAULT_PROFILE.size &&
    p.position === DEFAULT_PROFILE.position &&
    p.overlap === DEFAULT_PROFILE.overlap &&
    p.corner === "none" &&
    p.decoration === undefined
  );
}

/**
 * What a shop on Free shows for a saved profile (CLAUDE.md "Billing": a
 * downgrade never deletes the design). Keeps the parts Free allows.
 */
export function freeProfileOf(p: ProfileFacet): ProfileFacet {
  if (isFreeProfile(p)) return p;
  return {
    ...DEFAULT_PROFILE,
    borderWidth: p.borderWidth === "none" ? "none" : "thin",
    borderColor: p.borderColor.kind === "theme" ? p.borderColor : DEFAULT_PROFILE.borderColor,
  };
}

// ---------------------------------------------------------------------------
// Values

/** Checks values the validator can't (hex format, schedule shape). Null = refused. */
export function cleanProfile(p: ProfileFacet): ProfileFacet | null {
  let borderColor = p.borderColor;
  if (borderColor.kind === "custom") {
    const hex = normalizeHex(borderColor.hex);
    if (!hex) return null;
    borderColor = { kind: "custom", hex };
  } else {
    borderColor = { kind: "theme", token: borderColor.token };
  }
  const cleaned: ProfileFacet = {
    shape: p.shape,
    borderWidth: p.borderWidth,
    borderStyle: p.borderStyle,
    borderColor,
    size: p.size,
    position: p.position,
    overlap: p.overlap,
    corner: p.corner,
  };
  if (p.decoration) {
    if (scheduleShapeProblem(p.decoration) !== null) return null;
    cleaned.decoration = { id: p.decoration.id, startsAt: p.decoration.startsAt, endsAt: p.decoration.endsAt };
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Geometry (pure, tested): the photo box is 0–100 on both axes. The avatar
// is drawn with `overflow: visible`, so decorations may reach out to
// `-PROFILE_PAD … 100 + PROFILE_PAD`. They never enter the face zone, a
// circle around the centre (the photo is always cropped around its centre).

export const PROFILE_PAD = 34;
export const FACE_ZONE = { cx: 50, cy: 50, r: 26 } as const;

/** Halo (shop background, separates the photo from the banner) and border bands, in box units. */
export const PROFILE_HALO = 4.5;
export const BORDER_UNITS: Record<ProfileBorderWidth, number> = { none: 0, thin: 3.5, medium: 6, thick: 9 };

/** Displayed size of the photo box, px: [phones, md and up]. */
export const PROFILE_SIZE_PX: Record<ProfileSize, readonly [number, number]> = {
  sm: [52, 64],
  md: [64, 80],
  lg: [88, 112],
};

/** How far a shape's corners reach past a circle's (top, bottom), so corner decorations move out. */
const SHAPE_OUTSET: Record<ProfileShape, { top: number; bottom: number }> = {
  circle: { top: 0, bottom: 0 },
  flower: { top: 2, bottom: 2 },
  squircle: { top: 5, bottom: 5 },
  rounded: { top: 7, bottom: 7 },
  arch: { top: 0, bottom: 9 },
};

/** Small photos get relatively bigger decorations (still legible), big ones smaller (still subtle). */
const SIZE_SCALE: Record<ProfileSize, number> = { sm: 1.1, md: 1, lg: 0.9 };

type AnchorBase = {
  /** Attach point on the circle. */
  x: number;
  y: number;
  /** Artwork width at md size. */
  width: number;
  /** Where the attach point falls in the artwork (0–1 of width / height). */
  ax: number;
  ay: number;
  /** Direction the shape's outset pushes it (-1, 0, 1). */
  dx: number;
  dy: number;
  edge: "top" | "bottom";
  rotate: number;
};

const ANCHORS: Record<Exclude<DecorationAnchor, "ring">, AnchorBase> = {
  top: { x: 50, y: 10, width: 58, ax: 0.5, ay: 1, dx: 0, dy: 0, edge: "top", rotate: 0 },
  topSide: { x: 20, y: 18, width: 46, ax: 0.58, ay: 1, dx: -1, dy: -1, edge: "top", rotate: -16 },
  side: { x: 86, y: 14, width: 40, ax: 0.32, ay: 0.58, dx: 1, dy: -1, edge: "top", rotate: 0 },
  badge: { x: 50, y: 97, width: 64, ax: 0.5, ay: 0.5, dx: 0, dy: 1, edge: "bottom", rotate: 0 },
  sticker: { x: 13, y: 88, width: 38, ax: 0.58, ay: 0.42, dx: -1, dy: 1, edge: "bottom", rotate: -10 },
};

export type Box = { x: number; y: number; w: number; h: number; rotate: number };

/** Where a decoration is drawn for a photo shape and size (box units). */
export function decorationBox(entry: Pick<DecorationEntry, "anchor" | "aspect">, shape: ProfileShape, size: ProfileSize): Box {
  if (entry.anchor === "ring") {
    // The wreath follows the outer edge; its leaves stay in the band outside the face (`RING_INNER`).
    return { x: -8, y: -8, w: 116, h: 116, rotate: 0 };
  }
  const a = ANCHORS[entry.anchor];
  const outset = SHAPE_OUTSET[shape][a.edge];
  const w = a.width * SIZE_SCALE[size];
  const h = w * entry.aspect;
  const x = a.x + a.dx * outset - w * a.ax;
  const y = a.y + a.dy * outset - h * a.ay;
  return { x, y, w, h, rotate: a.rotate };
}

/** The wreath's inner radius (from the centre), box units: always outside the face zone. */
export const RING_INNER = 40;

/** Where the corner decoration sits: bottom-right, or top-left when a ribbon takes the bottom. */
export function cornerBox(shape: ProfileShape, size: ProfileSize, decoration: ProfileDecorationId | null): Box {
  const w = 26 * SIZE_SCALE[size];
  const ribbon = decoration !== null && decorationEntry(decoration).anchor === "badge";
  if (ribbon) {
    const o = SHAPE_OUTSET[shape].top;
    return { x: 15 - o - w / 2, y: 15 - o - w / 2, w, h: w, rotate: 0 };
  }
  const o = SHAPE_OUTSET[shape].bottom;
  return { x: 85 + o - w / 2, y: 85 + o - w / 2, w, h: w, rotate: 0 };
}

/** True when the box stays out of the face zone (axis-aligned box vs circle). */
export function clearOfFace(box: Box): boolean {
  const nx = Math.min(Math.max(FACE_ZONE.cx, box.x), box.x + box.w);
  const ny = Math.min(Math.max(FACE_ZONE.cy, box.y), box.y + box.h);
  return Math.hypot(nx - FACE_ZONE.cx, ny - FACE_ZONE.cy) >= FACE_ZONE.r;
}

/** True when the box fits in the avatar's drawing area. */
export function insidePad(box: Box): boolean {
  return box.x >= -PROFILE_PAD && box.y >= -PROFILE_PAD && box.x + box.w <= 100 + PROFILE_PAD && box.y + box.h <= 100 + PROFILE_PAD;
}

/** How far the avatar's drawing reaches past its photo box on each side, box units (0–100 = the box). */
export type AvatarOverflow = { left: number; top: number; right: number; bottom: number };

/** A box's bounds after its rotation (around its centre). */
function rotatedBounds(box: Box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = (box.rotate * Math.PI) / 180;
  const hw = Math.abs((box.w / 2) * Math.cos(r)) + Math.abs((box.h / 2) * Math.sin(r));
  const hh = Math.abs((box.w / 2) * Math.sin(r)) + Math.abs((box.h / 2) * Math.cos(r));
  return { left: cx - hw, top: cy - hh, right: cx + hw, bottom: cy + hh };
}

/** The soft glow border blurs a little past the shape. */
const GLOW_REACH = 6;

/**
 * What the header must leave around the photo box so the decoration, the
 * corner decoration and a glow border are fully visible: never past the
 * page's shared left edge, never on the text (CLAUDE.md "Shop looks" →
 * "Profile photo"). Pure; never negative.
 */
export function avatarOverflow(profile: {
  shape: ProfileShape;
  size: ProfileSize;
  decoration: ProfileDecorationId | null;
  corner: string;
  glow?: boolean;
}): AvatarOverflow {
  const out: AvatarOverflow = { left: 0, top: 0, right: 0, bottom: 0 };
  const boxes: Box[] = [];
  if (profile.decoration) boxes.push(decorationBox(decorationEntry(profile.decoration), profile.shape, profile.size));
  if (profile.corner !== "none") boxes.push(cornerBox(profile.shape, profile.size, profile.decoration));
  for (const box of boxes) {
    const b = rotatedBounds(box);
    out.left = Math.max(out.left, -b.left);
    out.top = Math.max(out.top, -b.top);
    out.right = Math.max(out.right, b.right - 100);
    out.bottom = Math.max(out.bottom, b.bottom - 100);
  }
  if (profile.glow) {
    for (const side of ["left", "top", "right", "bottom"] as const) out[side] = Math.max(out[side], GLOW_REACH);
  }
  return out;
}
