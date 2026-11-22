import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Ends "Back in stock" (lib/restock.ts), scheduled RESTOCK_DAYS after
 * "Sold out" was turned off. Only clears the restock it was scheduled
 * for: a later restock (new `restockedAt`) schedules its own job, so an
 * older job is harmless. A deleted product is ignored.
 */
export const endBackInStock = internalMutation({
  args: { productId: v.id("products"), restockedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { productId, restockedAt }) => {
    const product = await ctx.db.get("products", productId);
    if (!product || product.restockedAt !== restockedAt || !product.backInStock) return null;
    await ctx.db.patch("products", productId, { backInStock: undefined });
    return null;
  },
});
