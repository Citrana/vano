import { v } from "convex/values";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { fail } from "../lib/errors";
import { assertNotOwnShop } from "../lib/guards";
import { lookImageIds, sameLook, withoutAnnouncement, withoutPromo } from "../lib/looks/clean";
import {
  announcementTextOf,
  bannerTextOf,
  decorationOf,
  promoHeadlineOf,
  resetLook,
  resetReasonProblem,
} from "../lib/looks/reset";
import { lookRow, resolveWithUrl, visibleLook } from "../lib/looks/store";
import type { StoredLook } from "../lib/looks/validators";
import { notify } from "../lib/notify";
import { deleteFilesNotIn } from "../lib/seller";

/**
 * Admin view of a shop's look and the safe reset (CLAUDE.md "Shop looks"):
 * if a banner photo or text is inappropriate, an admin with
 * `shops.resetLook` removes it, with the event & promo banner ("banner"),
 * and the announcement bar ("banner"), resets the profile photo options
 * and decoration ("profile"), or resets everything to the free look,
 * default sections and layout ("all"), with a reason. Applies to the published look and the
 * draft, deletes the photos, is logged and tells the seller.
 */

/** The look without its dated parts (event banner, announcement bar), for comparisons. */
const undated = (look: StoredLook) => withoutAnnouncement(withoutPromo(look));

function announcementSummary(look: StoredLook | undefined, live: boolean) {
  const announcement = look?.overrides.announcement;
  if (!announcement) return null;
  return {
    text: announcement.text,
    /** The Promo bar's sale title (seller text, reviewed like the message). */
    title: announcement.title ?? null,
    startsAt: announcement.startsAt ?? null,
    endsAt: announcement.endsAt ?? null,
    live,
  };
}

function promoSummary(look: StoredLook | undefined, live: boolean) {
  const promo = look?.overrides.promo;
  if (!promo) return null;
  return {
    template: promo.design.template,
    headline: promo.design.headline,
    subline: promo.design.subline ?? null,
    startsAt: promo.startsAt ?? null,
    endsAt: promo.endsAt ?? null,
    live,
  };
}

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
      hiddenByPlan: row?.published !== undefined && !sameLook(undated(row.published), undated(visible)),
      /** The event & promo banner (published, then the draft's), for review. */
      promo: promoSummary(row?.published, row?.promoLive === true),
      draftPromo: promoSummary(row?.draft, false),
      /** The announcement bar (published, then the draft's), for review. */
      announcement: announcementSummary(row?.published, row?.announcementLive === true),
      draftAnnouncement: announcementSummary(row?.draft, false),
      /** The profile decoration (published, then the draft's), for review. */
      decoration: decorationOf(row?.published),
      decorationLive: row?.decorationLive === true,
      draftDecoration: decorationOf(row?.draft),
      /** The seller changed the profile photo options (published or draft). */
      hasProfile: row?.published?.overrides.profile !== undefined || row?.draft?.overrides.profile !== undefined,
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
    scope: v.union(v.literal("banner"), v.literal("profile"), v.literal("all")),
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
    const draft = row.draft && scope !== "all" ? resetLook(row.draft, scope) : undefined;
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
      // The promo and the announcement bar go with "banner" and "all"; the decoration with "profile" and "all".
      promoLive: scope === "profile" ? row.promoLive : false,
      announcementLive: scope === "profile" ? row.announcementLive : false,
      decorationLive: scope === "banner" ? row.decorationLive : false,
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
        bannerText: scope === "profile" ? "" : (bannerTextOf(row.published) ?? bannerTextOf(row.draft) ?? ""),
        bannerPhoto: scope !== "profile" && lookImageIds(row.published).length + lookImageIds(row.draft).length > 0,
        promoHeadline: scope === "profile" ? "" : (promoHeadlineOf(row.published) ?? promoHeadlineOf(row.draft) ?? ""),
        decoration: scope === "banner" ? "" : (decorationOf(row.published) ?? decorationOf(row.draft) ?? ""),
        announcement:
          scope === "profile" ? "" : (announcementTextOf(row.published) ?? announcementTextOf(row.draft) ?? ""),
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
