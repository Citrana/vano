import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { hiddenFromShop, shopProducts } from "../lib/entitlements";
import { fail } from "../lib/errors";
import { assertNotOwnShop } from "../lib/guards";
import { resetReasonProblem } from "../lib/looks/reset";
import { currencyValidator } from "../lib/money";
import { notify } from "../lib/notify";
import { affectedProducts } from "../lib/sales/active";
import { deleteSale, saleTotals, shopSales, writeLiveAndSchedule } from "../lib/sales/store";
import { saleDiscountValidator } from "../lib/sales/validators";
import type { AdminMutationCtx } from "../lib/access";

/**
 * Admin view of a shop's sales and moderation (CLAUDE.md "Sales"): with
 * `shops.manageSales` an admin pauses or deletes a sale (e.g. a
 * misleading price), with a reason, never on their own shop. Logged in
 * the activity history and the seller is told (they may resume a paused
 * sale once fixed). Reasons follow the look-reset rule.
 */

export const listForShop = adminQuery({
  permission: "shops.view",
  args: { shopId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      currency: currencyValidator,
      sales: v.array(
        v.object({
          _id: v.id("sales"),
          name: v.string(),
          discount: saleDiscountValidator,
          startsAt: v.number(),
          endsAt: v.number(),
          paused: v.boolean(),
          adminPause: v.union(v.object({ at: v.number(), reason: v.string() }), v.null()),
          live: v.boolean(),
          products: v.number(),
          views: v.number(),
          whatsappClicks: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const shopId = ctx.db.normalizeId("shops", args.shopId);
    const shop = shopId ? await ctx.db.get("shops", shopId) : null;
    if (!shop) return null;
    const products = (await shopProducts(ctx, shop._id)).filter((p) => !hiddenFromShop(p));
    const sales = [];
    for (const sale of await shopSales(ctx, shop._id)) {
      sales.push({
        _id: sale._id,
        name: sale.name,
        discount: sale.discount,
        startsAt: sale.startsAt,
        endsAt: sale.endsAt,
        paused: sale.paused,
        adminPause: sale.adminPause ?? null,
        live: sale.live,
        products: affectedProducts(sale, products, shop.currency).length,
        ...(await saleTotals(ctx, sale._id)),
      });
    }
    return { currency: shop.currency, sales };
  },
});

async function moderated(ctx: AdminMutationCtx, saleId: Doc<"sales">["_id"], reason: string) {
  const sale = await ctx.db.get("sales", saleId);
  if (!sale) fail("NOT_FOUND");
  const shop = await ctx.db.get("shops", sale.shopId);
  if (!shop) fail("NOT_FOUND");
  assertNotOwnShop(ctx.access, shop);
  if (resetReasonProblem(reason) !== null) fail("REASON_INVALID");
  return { sale, shop, reason: reason.trim() };
}

export const pause = adminMutation({
  permission: "shops.manageSales",
  args: { saleId: v.id("sales"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { sale, shop, reason } = await moderated(ctx, args.saleId, args.reason);
    const now = Date.now();
    await ctx.db.patch("sales", sale._id, {
      adminPause: { at: now, reason },
      version: sale.version + 1,
      updatedAt: now,
    });
    await writeLiveAndSchedule(ctx, (await ctx.db.get("sales", sale._id))!, now);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "sale.adminPaused",
      targetType: "shop",
      targetId: shop._id,
      targetLabel: `${shop.name} (/${shop.slug})`,
      details: { sale: sale.name, reason },
    });
    await notify(ctx, {
      data: { type: "sale.adminPaused", saleId: sale._id, name: sale.name, reason },
      to: { userId: shop.ownerId },
      dedupeKey: `sale.adminPaused:${sale._id}:${now}`,
    });
    return null;
  },
});

export const remove = adminMutation({
  permission: "shops.manageSales",
  args: { saleId: v.id("sales"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { sale, shop, reason } = await moderated(ctx, args.saleId, args.reason);
    await deleteSale(ctx, sale);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "sale.adminDeleted",
      targetType: "shop",
      targetId: shop._id,
      targetLabel: `${shop.name} (/${shop.slug})`,
      details: { sale: sale.name, reason },
    });
    await notify(ctx, {
      data: { type: "sale.adminDeleted", name: sale.name, reason },
      to: { userId: shop.ownerId },
      dedupeKey: `sale.adminDeleted:${sale._id}`,
    });
    return null;
  },
});
