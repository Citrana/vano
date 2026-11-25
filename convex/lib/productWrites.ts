import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { onProductDeleted } from "./platformStats";
import { forgetProductInSales } from "./sales/store";
import { forgetProductInCodes } from "./discountCodes/store";
import { recordProductEvent } from "./productStock";
import { deleteFilesNotIn } from "./seller";

/**
 * Deletes a product completely: its images (and their upload rows), its
 * daily stats, its place in the shop's sales and discount codes, its counter entry, then the
 * product. Used by the seller
 * (`products.remove`) and the admin (`admin.products.remove`), so both
 * clean up exactly the same way. Callers check permission / ownership.
 * Recorded sales are never deleted (CLAUDE.md "Sales tracking"): they keep
 * their snapshot, and `deleteFilesNotIn` keeps a photo a sale still uses.
 * The product's history gets a "deleted" row.
 */
export async function deleteProduct(ctx: MutationCtx, product: Doc<"products">, byUserId?: Id<"users">): Promise<void> {
  await recordProductEvent(ctx, product, "deleted", { at: Date.now(), byUserId });
  await deleteFilesNotIn(ctx, product.imageIds, []);
  for await (const row of ctx.db
    .query("productDailyStats")
    .withIndex("by_productId_and_day", (q) => q.eq("productId", product._id))) {
    await ctx.db.delete("productDailyStats", row._id);
  }
  await forgetProductInSales(ctx, product);
  await forgetProductInCodes(ctx, product);
  await onProductDeleted(ctx, product);
  await ctx.db.delete("products", product._id);
}
