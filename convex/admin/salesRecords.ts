import { v } from "convex/values";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { fail } from "../lib/errors";
import { assertNotOwnShop } from "../lib/guards";
import { resetReasonProblem } from "../lib/looks/reset";
import { currencyValidator } from "../lib/money";
import { sumRecords } from "../lib/salesRecords/pricing";
import { LIST_MAX } from "../lib/salesRecords/rules";
import { saleSourceValidator } from "../lib/salesRecords/validators";

/**
 * Admin view of a shop's recorded sales (CLAUDE.md "Sales tracking"):
 * totals for anyone with `shops.view`, never customer data. Customer
 * names and phones need `shops.viewCustomers` and a reason, never on the
 * admin's own shop, and every look is logged in the activity history
 * (a mutation, because a query can't write the log).
 */

/** How many recent sales a reveal returns. */
export const REVEAL_MAX = 50;

export const summaryForShop = adminQuery({
  permission: "shops.view",
  args: { shopId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      currency: currencyValidator,
      count: v.number(),
      items: v.number(),
      revenue: v.number(),
      discounts: v.number(),
      reversed: v.number(),
      truncated: v.boolean(),
      lastSoldAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const shopId = ctx.db.normalizeId("shops", args.shopId);
    const shop = shopId ? await ctx.db.get("shops", shopId) : null;
    if (!shop) return null;
    const records = await ctx.db
      .query("salesRecords")
      .withIndex("by_shopId_and_soldAt", (q) => q.eq("shopId", shop._id))
      .order("desc")
      .take(LIST_MAX + 1);
    const truncated = records.length > LIST_MAX;
    const shown = records.slice(0, LIST_MAX);
    return {
      currency: shop.currency,
      ...sumRecords(shown),
      reversed: shown.filter((r) => r.status === "reversed").length,
      truncated,
      lastSoldAt: shown[0]?.soldAt ?? null,
    };
  },
});

export const revealCustomers = adminMutation({
  permission: "shops.viewCustomers",
  args: { shopId: v.id("shops"), reason: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("salesRecords"),
      productName: v.string(),
      soldAt: v.number(),
      source: saleSourceValidator,
      customerName: v.union(v.string(), v.null()),
      customerPhone: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { shopId, reason }) => {
    const shop = await ctx.db.get("shops", shopId);
    if (!shop) fail("NOT_FOUND");
    await assertNotOwnShop(ctx, ctx.access, shop);
    if (resetReasonProblem(reason) !== null) fail("REASON_INVALID");
    const records = await ctx.db
      .query("salesRecords")
      .withIndex("by_shopId_and_soldAt", (q) => q.eq("shopId", shop._id))
      .order("desc")
      .take(REVEAL_MAX);
    const rows = records
      .filter((r) => r.customerName !== undefined || r.customerPhone !== undefined)
      .map((r) => ({
        _id: r._id,
        productName: r.productName,
        soldAt: r.soldAt,
        source: r.source,
        customerName: r.customerName ?? null,
        customerPhone: r.customerPhone ?? null,
      }));
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "salesRecord.customersViewed",
      targetType: "shop",
      targetId: shop._id,
      targetLabel: `${shop.name} (/${shop.slug})`,
      details: { reason: reason.trim(), records: rows.length },
    });
    return rows;
  },
});
