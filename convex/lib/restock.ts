import type { Doc } from "../_generated/dataModel";

/**
 * "Back in stock" (CLAUDE.md "Shop looks"): when the seller turns "Sold
 * out" off, the product is marked back in stock for RESTOCK_DAYS, then
 * `productJobs.endBackInStock` (scheduled at the end) clears it. Turning
 * "Sold out" on again clears it at once. Pure; `products.update` and
 * `products.setSoldOut` apply it. Queries never read the clock: the shop
 * page reads the stored `backInStock` flag.
 */

export const RESTOCK_DAYS = 14;
export const RESTOCK_MS = RESTOCK_DAYS * 86_400_000;

type StockFields = Pick<Doc<"products">, "soldOut" | "restockedAt" | "backInStock" | "fewLeft">;

/**
 * The stock fields after setting `soldOut`. `restocked` = a job must be
 * scheduled at `restockedAt + RESTOCK_MS`.
 */
export function stockChange(
  product: StockFields,
  soldOut: boolean,
  now: number,
): { fields: Pick<StockFields, "soldOut" | "restockedAt" | "backInStock" | "fewLeft">; restocked: boolean } {
  if (soldOut) {
    // Sold out: no longer back in stock, and "few left" no longer applies.
    return { fields: { soldOut: true, restockedAt: undefined, backInStock: undefined, fewLeft: undefined }, restocked: false };
  }
  if (product.soldOut) {
    return { fields: { soldOut: false, restockedAt: now, backInStock: true, fewLeft: product.fewLeft }, restocked: true };
  }
  return {
    fields: { soldOut: false, restockedAt: product.restockedAt, backInStock: product.backInStock, fewLeft: product.fewLeft },
    restocked: false,
  };
}
