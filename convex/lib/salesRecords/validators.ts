import { v, type Infer } from "convex/values";

/**
 * Validators for recorded sales (CLAUDE.md "Sales tracking"). Not to be
 * confused with `lib/sales/` (promotions, shown as "Offers").
 */

export const SALE_SOURCES = ["whatsapp", "instagram", "tiktok", "inPerson", "other"] as const;
export const saleSourceValidator = v.union(
  v.literal("whatsapp"),
  v.literal("instagram"),
  v.literal("tiktok"),
  v.literal("inPerson"),
  v.literal("other"),
);
export type SaleSource = Infer<typeof saleSourceValidator>;

export const recordStatusValidator = v.union(v.literal("recorded"), v.literal("reversed"));
export type RecordStatus = Infer<typeof recordStatusValidator>;

/** The offer the customer got when the sale was recorded (snapshot). */
export const recordOfferValidator = v.union(
  v.object({ kind: v.literal("sale"), percent: v.number() }),
  v.object({ kind: v.literal("code"), code: v.string(), percent: v.number() }),
);
export type RecordOffer = Infer<typeof recordOfferValidator>;

export const PRODUCT_EVENT_KINDS = ["soldOut", "backOnSale", "sold", "saleEdited", "saleReversed", "deleted"] as const;
export const productEventKindValidator = v.union(
  v.literal("soldOut"),
  v.literal("backOnSale"),
  v.literal("sold"),
  v.literal("saleEdited"),
  v.literal("saleReversed"),
  v.literal("deleted"),
);
export type ProductEventKind = Infer<typeof productEventKindValidator>;

/** What the seller fills in to record a sale. */
export const recordInputFields = {
  productId: v.id("products"),
  size: v.optional(v.string()),
  color: v.optional(v.string()),
  quantity: v.number(),
  /** Integer minor units, per item: what the customer actually paid. */
  finalUnitPrice: v.number(),
  /** A discount code the customer used (optional; recomputed here). */
  code: v.optional(v.string()),
  source: saleSourceValidator,
  customerName: v.optional(v.string()),
  customerPhone: v.optional(v.string()),
  soldAt: v.number(),
  markSoldOut: v.boolean(),
  /** The browser's zone: saved on the shop if it has none yet. */
  timeZone: v.optional(v.string()),
};
