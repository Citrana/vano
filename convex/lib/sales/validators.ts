import { v, type Infer } from "convex/values";
import { categoryValidator } from "../catalog";

/**
 * The shape of a sale (CLAUDE.md "Sales"). Shared by the schema, the
 * seller / admin functions and the UI. A future discount code reuses
 * `saleDiscountValidator` and `discountedPrice` (discount.ts).
 */

/** Percent off (1–90), an amount off, or a set sale price (minor units). */
export const saleDiscountValidator = v.object({
  kind: v.union(v.literal("percent"), v.literal("amount"), v.literal("price")),
  value: v.number(),
});
export type SaleDiscount = Infer<typeof saleDiscountValidator>;
export type DiscountKind = SaleDiscount["kind"];
export const DISCOUNT_KINDS = ["percent", "amount", "price"] as const satisfies readonly DiscountKind[];

/**
 * Which products: chosen ones, one category or the whole shop. Category
 * and whole-shop sales can exclude products.
 */
export const saleTargetValidator = v.union(
  v.object({ kind: v.literal("products"), productIds: v.array(v.id("products")) }),
  v.object({
    kind: v.literal("category"),
    category: categoryValidator,
    excludedIds: v.array(v.id("products")),
  }),
  v.object({ kind: v.literal("shop"), excludedIds: v.array(v.id("products")) }),
);
export type SaleTarget = Infer<typeof saleTargetValidator>;

/** What the shop shows on sale items. */
export const saleDisplayValidator = v.object({
  countdown: v.boolean(),
  badge: v.boolean(),
  label: v.boolean(),
});
export type SaleDisplay = Infer<typeof saleDisplayValidator>;

/** What the seller sends to create or edit a sale. */
export const saleInputFields = {
  name: v.string(),
  discount: saleDiscountValidator,
  target: saleTargetValidator,
  /** Missing = start now. UTC ms. */
  startsAt: v.optional(v.number()),
  endsAt: v.number(),
  display: saleDisplayValidator,
  /** The seller confirmed a discount over `STEEP_PERCENT`. */
  steepConfirmed: v.boolean(),
};

/** A product as the sale and discount code editors list it (`pickerProducts`). */
export const pickerProductValidator = v.object({
  _id: v.id("products"),
  name: v.string(),
  price: v.number(),
  category: categoryValidator,
  soldOut: v.boolean(),
  coverUrl: v.union(v.string(), v.null()),
});
