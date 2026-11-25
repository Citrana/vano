import { v, type Infer } from "convex/values";
import { saleTargetValidator } from "../sales/validators";

/**
 * The shape of a discount code (CLAUDE.md "Discount codes"). Shared by the
 * schema, the seller / admin functions and the UI. The discount is the
 * sale discount without "set price" (so `discountedPrice` applies as is)
 * and the target is the sale target (chosen products, a category or the
 * whole shop, with exclusions).
 */

/** Percent off (1–90) or an amount off (minor units). */
export const codeDiscountValidator = v.object({
  kind: v.union(v.literal("percent"), v.literal("amount")),
  value: v.number(),
});
export type CodeDiscount = Infer<typeof codeDiscountValidator>;
export type CodeDiscountKind = CodeDiscount["kind"];
export const CODE_DISCOUNT_KINDS = ["percent", "amount"] as const satisfies readonly CodeDiscountKind[];

export const codeTargetValidator = saleTargetValidator;

/** What the seller sends to create or edit a code. */
export const codeInputFields = {
  /** Any case; stored upper case. */
  code: v.string(),
  discount: codeDiscountValidator,
  target: codeTargetValidator,
  /** Missing = start now. UTC ms. */
  startsAt: v.optional(v.number()),
  endsAt: v.number(),
  /** Missing = no limit. */
  maxUses: v.optional(v.number()),
};

/** What a visitor gets when they try a code on a product. */
export const codeResultValidator = v.union(
  v.object({
    status: v.literal("applied"),
    code: v.string(),
    /** What the customer pays with the code. */
    price: v.number(),
    /** The product's real normal price (crossed out). */
    original: v.number(),
    percent: v.number(),
  }),
  v.object({
    status: v.union(
      v.literal("invalid"),
      v.literal("notActive"),
      v.literal("ended"),
      v.literal("usedUp"),
      v.literal("notForProduct"),
      v.literal("saleBetter"),
      v.literal("tooMany"),
      v.literal("soldOut"),
    ),
  }),
);
export type CodeResult = Infer<typeof codeResultValidator>;
export type CodeProblem = Exclude<CodeResult, { status: "applied" }>["status"];
