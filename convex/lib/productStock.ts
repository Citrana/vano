import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getEntitlements } from "./entitlements";
import { notify } from "./notify";
import { RESTOCK_MS, stockChange } from "./restock";
import { isTracked, stockFlags } from "./stock";
import type { ProductEventKind } from "./salesRecords/validators";

/**
 * The one writer of a product's "Sold out" state, its pieces in stock and
 * its history (CLAUDE.md "Sales tracking"): `products.setSoldOut`,
 * `products.update` and recorded sales go through `applyStock` /
 * `stockUpdate` / `applyPieces`, so every change lands in `productEvents`.
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

/** Whether the product's pieces drive its labels now (count set, plan has `stockManagement`). */
export async function piecesTracked(ctx: MutationCtx, shop: Doc<"shops">, product: Pick<Doc<"products">, "pieces">) {
  if (product.pieces === undefined) return false;
  const { limits } = await getEntitlements(ctx, shop, Date.now());
  return isTracked(product, limits);
}

/**
 * Sets a tracked product's pieces: "Few left" at 3 or fewer, "Sold out" at
 * 0 (with its history row; coming back from 0 marks it back in stock).
 * Returns whether this change sold the product out.
 */
export async function applyPieces(
  ctx: MutationCtx,
  product: Doc<"products">,
  pieces: number,
  now: number,
  by: { byUserId?: Id<"users">; salesRecordId?: Id<"salesRecords"> },
): Promise<boolean> {
  const flags = stockFlags(pieces);
  const fields = await stockUpdate(ctx, product, flags.soldOut, now, by);
  await ctx.db.patch("products", product._id, { ...fields, fewLeft: flags.fewLeft || undefined, pieces, updatedAt: now });
  return flags.soldOut && !product.soldOut;
}

/** "<product> is sold out" for the seller, when a sale took the last piece. */
export async function notifySoldOut(ctx: MutationCtx, shop: Doc<"shops">, product: Doc<"products">, now: number) {
  await notify(ctx, {
    data: { type: "product.soldOut", productId: product._id, name: product.name },
    to: { shop },
    dedupeKey: `product.soldOut:${product._id}:${now}`,
  });
}
