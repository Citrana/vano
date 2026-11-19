import { v } from "convex/values";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { fail } from "../lib/errors";
import { assertNotOwnShop } from "../lib/guards";
import { lookImageIds, sameLook } from "../lib/looks/clean";
import { bannerTextOf, resetLook, resetReasonProblem } from "../lib/looks/reset";
import { lookRow, resolveWithUrl, visibleLook } from "../lib/looks/store";
import { notify } from "../lib/notify";
import { deleteFilesNotIn } from "../lib/seller";

/**
 * Admin view of a shop's look and the safe reset (CLAUDE.md "Shop looks"):
 * if a banner photo or text is inappropriate, an admin with
 * `shops.resetLook` removes it ("banner") or resets everything to the free
 * look ("all"), with a reason. Applies to the published look and the
 * draft, deletes the photos, is logged and tells the seller.
 */

export const get = adminQuery({
  permission: "shops.view",
  args: { shopId: v.string() },
  handler: async (ctx, args) => {
    const shopId = ctx.db.normalizeId("shops", args.shopId);
    const shop = shopId ? await ctx.db.get("shops", shopId) : null;
    if (!shop) return null;
    const row = await lookRow(ctx, shop._id);
    const visible = await visibleLook(ctx, shop);
    return {
      /** What visitors see now. */
      visible: await resolveWithUrl(ctx, visible),
      /** A published design the plan doesn't show (visitors see the free look). */
      hiddenByPlan: row?.published !== undefined && !sameLook(row.published, visible),
      /** The seller's published design (may be hidden by their plan). */
      published: row?.published ? await resolveWithUrl(ctx, row.published) : null,
      publishedBannerText: bannerTextOf(row?.published),
      draftBannerText: bannerTextOf(row?.draft),
      draftHasPhoto: lookImageIds(row?.draft).length > 0,
      publishedAt: row?.publishedAt ?? null,
      resetByAdminAt: row?.resetByAdminAt ?? null,
    };
  },
});

export const reset = adminMutation({
  permission: "shops.resetLook",
  args: {
    shopId: v.id("shops"),
    scope: v.union(v.literal("banner"), v.literal("all")),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { shopId, scope, reason }) => {
    const shop = await ctx.db.get("shops", shopId);
    if (!shop) fail("NOT_FOUND");
    assertNotOwnShop(ctx.access, shop);
    if (resetReasonProblem(reason) !== null) fail("REASON_INVALID");
    const cleanReason = reason.trim();
    const row = await lookRow(ctx, shopId);
    if (!row) return null; // Never designed: already the free look.

    const published = row.published ? resetLook(row.published, scope) : undefined;
    const draft = row.draft && scope === "banner" ? resetLook(row.draft, scope) : undefined;
    await deleteFilesNotIn(
      ctx,
      [...lookImageIds(row.published), ...lookImageIds(row.draft)],
      [...lookImageIds(published), ...lookImageIds(draft)],
    );
    const now = Date.now();
    await ctx.db.patch("shopLooks", row._id, {
      published,
      draft,
      draftUpdatedAt: draft ? row.draftUpdatedAt : undefined,
      resetByAdminAt: now,
    });

    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "shop.lookReset",
      targetType: "shop",
      targetId: shopId,
      targetLabel: `${shop.name} (/${shop.slug})`,
      details: {
        scope,
        reason: cleanReason,
        // What was removed, for the record.
        bannerText: bannerTextOf(row.published) ?? bannerTextOf(row.draft) ?? "",
        bannerPhoto: lookImageIds(row.published).length + lookImageIds(row.draft).length > 0,
      },
    });
    await notify(ctx, {
      data: { type: "look.reset", scope, reason: cleanReason },
      to: { userId: shop.ownerId },
      dedupeKey: `look.reset:${shopId}:${now}`,
    });
    return null;
  },
});
