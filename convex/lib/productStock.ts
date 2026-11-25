import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { RESTOCK_MS, stockChange } from "./restock";
import type { ProductEventKind } from "./salesRecords/validators";

/**
 * The one writer of a product's "Sold out" state and its history
 * (CLAUDE.md "Sales tracking"): `products.setSoldOut`, `products.update`,
 * `salesRecords.record` and `salesRecords.reverse` all go through
 * `applyStock`, so every change lands in `productEvents`.
 */

/** Adds a row to the product's history. */
export async function recordProductEvent(
  ctx: MutationCtx,
  product: Pick<Doc<"products">, "_id" | "shopId" | "name">,
  kind: ProductEventKind,
  extra: { at: number; byUserId?: Id<"users">; salesRecordId?: Id<"salesRecords"> },
): Promise<void> {
  await ctx.db.insert("productEvents", {
    shopId: product.shopId,
    productId: product._id,
    productName: product.name,
    kind,
    at: extra.at,
    byUserId: extra.byUserId,
    salesRecordId: extra.salesRecordId,
  });
}

/** Schedules the end of "Back in stock" for a restock (lib/restock.ts). */
export async function scheduleRestockEnd(ctx: MutationCtx, productId: Id<"products">, restockedAt: number) {
  await ctx.scheduler.runAt(restockedAt + RESTOCK_MS, internal.productJobs.endBackInStock, { productId, restockedAt });
}

/**
 * The stock fields after setting `soldOut` (`stockChange`), plus the
 * history row and the "Back in stock" job. Doesn't write the product:
 * callers patch / replace it with `fields` (so `products.update` keeps
 * one `replace`). Nothing happens when the state doesn't change.
 */
export async function stockUpdate(
  ctx: MutationCtx,
  product: Doc<"products">,
  soldOut: boolean,
  now: number,
  by: { byUserId?: Id<"users">; salesRecordId?: Id<"salesRecords"> },
): Promise<ReturnType<typeof stockChange>["fields"]> {
  const stock = stockChange(product, soldOut, now);
  if (product.soldOut !== soldOut) {
    await recordProductEvent(ctx, product, soldOut ? "soldOut" : "backOnSale", { at: now, ...by });
    if (stock.restocked) await scheduleRestockEnd(ctx, product._id, now);
  }
  return stock.fields;
}

/** Sets "Sold out" on a product (patch), with its history. Returns whether it changed. */
export async function applyStock(
  ctx: MutationCtx,
  product: Doc<"products">,
  soldOut: boolean,
  now: number,
  by: { byUserId?: Id<"users">; salesRecordId?: Id<"salesRecords"> },
): Promise<boolean> {
  if (product.soldOut === soldOut) return false;
  const fields = await stockUpdate(ctx, product, soldOut, now, by);
  await ctx.db.patch("products", product._id, { ...fields, updatedAt: now });
  return true;
}
