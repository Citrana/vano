import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { onProductDeleted } from "./platformStats";
import { deleteFilesNotIn } from "./seller";

/**
 * Deletes a product completely: its images (and their upload rows), its
 * daily stats, its counter entry, then the product. Used by the seller
 * (`products.remove`) and the admin (`admin.products.remove`), so both
 * clean up exactly the same way. Callers check permission / ownership.
 */
export async function deleteProduct(ctx: MutationCtx, product: Doc<"products">): Promise<void> {
  await deleteFilesNotIn(ctx, product.imageIds, []);
  for await (const row of ctx.db
    .query("productDailyStats")
    .withIndex("by_productId_and_day", (q) => q.eq("productId", product._id))) {
    await ctx.db.delete("productDailyStats", row._id);
  }
  await onProductDeleted(ctx, product);
  await ctx.db.delete("products", product._id);
}
