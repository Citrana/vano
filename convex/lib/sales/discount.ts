import { priceProblem, roundPrice, type Currency } from "../money";
import type { SaleDiscount } from "./validators";

/**
 * Discount maths (CLAUDE.md "Sales"). Pure; used by the server (what
 * visitors pay), the sale editor (preview, overview) and, later, discount
 * codes. The product's real price is never changed: a sale only computes
 * a price on top of it, so editing the normal price during a sale keeps
 * the sale working on the new price.
 */

export const PERCENT_MIN = 1;
export const PERCENT_MAX = 90;
/** Above this many percent off, the seller must confirm. */
export const STEEP_PERCENT = 80;

/** Shape problems, independent of any product. */
export function discountProblem(discount: SaleDiscount): "percent" | "amount" | null {
  if (discount.kind === "percent") {
    const p = discount.value;
    return Number.isInteger(p) && p >= PERCENT_MIN && p <= PERCENT_MAX ? null : "percent";
  }
  return priceProblem(discount.value) === null ? null : "amount";
}

/**
 * The sale price of a product at `price`, or null when this discount
 * doesn't lower it (an amount or set price at or above the normal price).
 * Percent off is rounded for the currency; amounts the seller typed are
 * used as they are. Always above zero and below `price`.
 */
export function discountedPrice(price: number, discount: SaleDiscount, currency: Currency): number | null {
  if (discountProblem(discount) !== null || priceProblem(price) !== null) return null;
  let sale: number;
  switch (discount.kind) {
    case "percent": {
      const exact = Math.round((price * (100 - discount.value)) / 100);
      sale = roundPrice(Math.min(exact, price - 1), currency, price);
      break;
    }
    case "amount":
      sale = price - discount.value;
      break;
    case "price":
      sale = discount.value;
      break;
  }
  return sale > 0 && sale < price ? sale : null;
}

/** Whole percent off shown on the badge ("-30%"); at least 1. */
export function percentOff(price: number, salePrice: number): number {
  return Math.max(1, Math.round(((price - salePrice) * 100) / price));
}

/** Whether a sale price is more than `STEEP_PERCENT` off. */
export function isSteep(price: number, salePrice: number): boolean {
  return (price - salePrice) * 100 > price * STEEP_PERCENT;
}
