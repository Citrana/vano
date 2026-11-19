/**
 * THE sticker list for event & promo banners (see README.md in this
 * folder). Pure data, no imports: the Convex server imports it to check
 * stored sticker ids, the client pairs it with the files in `files.ts`.
 *
 * - `id`: stored in sellers' banners. Never rename or remove an id that is
 *   in use; replace its file instead.
 * - `file`: the SVG in this folder.
 * - `tint`: "palette" = a one-colour silhouette, recoloured with the
 *   banner palette's sticker colour; "none" = a full-colour illustration
 *   shown as drawn.
 * - `aspect`: width / height of the artwork.
 * - Labels: `EventBanners.stickers.<id>` in messages/en.json + fr.json.
 */

export type StickerCategory = "sale" | "shapes" | "love" | "nature" | "seasonal";

export type StickerEntry = {
  id: string;
  file: string;
  category: StickerCategory;
  tint: "palette" | "none";
  aspect: number;
  keywords: readonly string[];
};

export const STICKERS = [
  { id: "percentBurst", file: "percent-burst.svg", category: "sale", tint: "palette", aspect: 1, keywords: ["sale", "discount"] },
  { id: "saleTag", file: "sale-tag.svg", category: "sale", tint: "palette", aspect: 1, keywords: ["price", "tag"] },
  { id: "shoppingBag", file: "shopping-bag.svg", category: "sale", tint: "palette", aspect: 1, keywords: ["shop", "bag"] },
  { id: "star", file: "star.svg", category: "shapes", tint: "palette", aspect: 1, keywords: ["star"] },
  { id: "sparkles", file: "sparkles.svg", category: "shapes", tint: "palette", aspect: 1, keywords: ["shine", "new"] },
  { id: "diamond", file: "diamond.svg", category: "shapes", tint: "palette", aspect: 1, keywords: ["gem", "luxury"] },
  { id: "crown", file: "crown.svg", category: "shapes", tint: "palette", aspect: 1, keywords: ["queen", "vip"] },
  { id: "heart", file: "heart.svg", category: "love", tint: "palette", aspect: 1, keywords: ["love"] },
  { id: "heartOutline", file: "heart-outline.svg", category: "love", tint: "palette", aspect: 1, keywords: ["love"] },
  { id: "bow", file: "bow.svg", category: "love", tint: "palette", aspect: 1.4, keywords: ["ribbon", "gift"] },
  { id: "flower", file: "flower.svg", category: "nature", tint: "palette", aspect: 1, keywords: ["flower", "spring"] },
  { id: "tulip", file: "tulip.svg", category: "nature", tint: "palette", aspect: 0.7, keywords: ["flower"] },
  { id: "leaves", file: "leaves.svg", category: "nature", tint: "palette", aspect: 1, keywords: ["leaf", "plant"] },
  { id: "sun", file: "sun.svg", category: "nature", tint: "palette", aspect: 1, keywords: ["summer"] },
  { id: "crescent", file: "crescent.svg", category: "seasonal", tint: "palette", aspect: 1, keywords: ["moon", "eid"] },
  { id: "lantern", file: "lantern.svg", category: "seasonal", tint: "palette", aspect: 0.6, keywords: ["eid", "light"] },
  { id: "ornament", file: "ornament.svg", category: "seasonal", tint: "palette", aspect: 0.8, keywords: ["christmas"] },
  { id: "snowflake", file: "snowflake.svg", category: "seasonal", tint: "palette", aspect: 1, keywords: ["winter", "christmas"] },
  { id: "gift", file: "gift.svg", category: "seasonal", tint: "palette", aspect: 1, keywords: ["present"] },
  { id: "confetti", file: "confetti.svg", category: "seasonal", tint: "palette", aspect: 1, keywords: ["party", "new year"] },
  { id: "balloon", file: "balloon.svg", category: "seasonal", tint: "palette", aspect: 0.6, keywords: ["party"] },
  { id: "pencil", file: "pencil.svg", category: "seasonal", tint: "palette", aspect: 1, keywords: ["school"] },
] as const satisfies readonly StickerEntry[];

export type StickerId = (typeof STICKERS)[number]["id"];

export const STICKER_IDS: readonly StickerId[] = STICKERS.map((s) => s.id);

export const STICKER_CATEGORIES: readonly StickerCategory[] = ["sale", "shapes", "love", "nature", "seasonal"];

export function isStickerId(id: string): id is StickerId {
  return (STICKER_IDS as readonly string[]).includes(id);
}

export function stickerById(id: StickerId): StickerEntry {
  return STICKERS.find((s) => s.id === id)!;
}
