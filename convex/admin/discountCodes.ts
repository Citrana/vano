import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { adminMutation, adminQuery, type AdminMutationCtx } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { deleteCode, shopCodes, writeCodeLiveAndSchedule } from "../lib/discountCodes/store";
import { codeDiscountValidator } from "../lib/discountCodes/validators";
import { hiddenFromShop, shopProducts } from "../lib/entitlements";
import { fail } from "../lib/errors";
import { assertNotOwnShop } from "../lib/guards";
import { resetReasonProblem } from "../lib/looks/reset";
import { currencyValidator } from "../lib/money";
import { notify } from "../lib/notify";
import { affectedProducts } from "../lib/sales/active";

/**
 * Admin view of a shop's discount codes and moderation (CLAUDE.md
 * "Discount codes"): with `shops.manageDiscountCodes` an admin pauses or
 * deletes a code (e.g. a misleading offer), with a reason, never on their
 * own shop. Logged in the activity history and the seller is told (they
 * may resume a paused code once fixed). Reasons follow the look-reset rule.
 */

export const listForShop = adminQuery({
  permission: "shops.view",
  args: { shopId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      currency: currencyValidator,
      codes: v.array(
        v.object({
          _id: v.id("discountCodes"),
          code: v.string(),
          discount: codeDiscountValidator,
          startsAt: v.number(),
          endsAt: v.number(),
          maxUses: v.union(v.number(), v.null()),
          uses: v.number(),
          paused: v.boolean(),
          adminPause: v.union(v.object({ at: v.number(), reason: v.string() }), v.null()),
          live: v.boolean(),
          products: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const shopId = ctx.db.normalizeId("shops", args.shopId);
    const shop = shopId ? await ctx.db.get("shops", shopId) : null;
    if (!shop) return null;
    const products = (await shopProducts(ctx, shop._id)).filter((p) => !hiddenFromShop(p));
    const codes = (await shopCodes(ctx, shop._id)).map((code) => ({
      _id: code._id,
      code: code.code,
      discount: code.discount,
      startsAt: code.startsAt,
      endsAt: code.endsAt,
      maxUses: code.maxUses ?? null,
      uses: code.uses,
      paused: code.paused,
      adminPause: code.adminPause ?? null,
      live: code.live,
      products: affectedProducts(code, products, shop.currency).length,
    }));
    return { currency: shop.currency, codes };
  },
});

async function moderated(ctx: AdminMutationCtx, codeId: Id<"discountCodes">, reason: string) {
  const code = await ctx.db.get("discountCodes", codeId);
  if (!code) fail("NOT_FOUND");
  const shop = await ctx.db.get("shops", code.shopId);
  if (!shop) fail("NOT_FOUND");
  assertNotOwnShop(ctx.access, shop);
  if (resetReasonProblem(reason) !== null) fail("REASON_INVALID");
  return { code, shop, reason: reason.trim() };
}

export const pause = adminMutation({
  permission: "shops.manageDiscountCodes",
  args: { codeId: v.id("discountCodes"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { code, shop, reason } = await moderated(ctx, args.codeId, args.reason);
    const now = Date.now();
    await ctx.db.patch("discountCodes", code._id, {
      adminPause: { at: now, reason },
      version: code.version + 1,
      updatedAt: now,
    });
    await writeCodeLiveAndSchedule(ctx, (await ctx.db.get("discountCodes", code._id))!, now);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "discountCode.adminPaused",
      targetType: "shop",
      targetId: shop._id,
      targetLabel: `${shop.name} (/${shop.slug})`,
      details: { code: code.code, reason },
    });
    await notify(ctx, {
      data: { type: "discountCode.adminPaused", codeId: code._id, code: code.code, reason },
      to: { userId: shop.ownerId },
      dedupeKey: `discountCode.adminPaused:${code._id}:${now}`,
    });
    return null;
  },
});

export const remove = adminMutation({
  permission: "shops.manageDiscountCodes",
  args: { codeId: v.id("discountCodes"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { code, shop, reason } = await moderated(ctx, args.codeId, args.reason);
    await deleteCode(ctx, code);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "discountCode.adminDeleted",
      targetType: "shop",
      targetId: shop._id,
      targetLabel: `${shop.name} (/${shop.slug})`,
      details: { code: code.code, reason },
    });
    await notify(ctx, {
      data: { type: "discountCode.adminDeleted", code: code.code, reason },
      to: { userId: shop.ownerId },
      dedupeKey: `discountCode.adminDeleted:${code._id}`,
    });
    return null;
  },
});
