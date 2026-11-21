import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { hasFeature, requireCan } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { cleanLook, lookImageIds, sameLook, withoutPromo } from "./lib/looks/clean";
import { hasBlockingProblem, lookProblems } from "./lib/looks/contrast";
import { FREE_LOOK, isFreeLook } from "./lib/looks/presets";
import { resolveLook } from "./lib/looks/resolve";
import { liveFlags, promoBoundaries, scheduleProblem } from "./lib/looks/schedule";
import { bannerUrls, lookRow } from "./lib/looks/store";
import { liveSalesFor } from "./lib/sales/store";
import { storedLookValidator, type StoredLook } from "./lib/looks/validators";
import { claimImages, deleteFilesNotIn, requireOwnShop, sellerMutation, sellerQuery } from "./lib/seller";

/**
 * The seller's "Shop look" editor (CLAUDE.md "Shop looks"). Edits are
 * saved as a draft (any plan); `publish` makes the draft what visitors
 * see. Publishing anything but the free look needs the `allLooks` plan
 * feature, and a look with a blocking contrast problem is refused.
 * A banner photo is claimed when a draft first uses it, and deleted once
 * neither the draft nor the published look uses it.
 *
 * Event & promo banners (`overrides.promo`) need the `salesPromotions`
 * plan feature to publish. Whether the published one is live is stored on
 * the row (`promoLive`); the profile decoration's the same way
 * (`decorationLive`). Both are updated by `shopLookJobs.syncSchedules`,
 * scheduled at their start and end (lib/looks/schedule.ts).
 */

/** Whether the published promo / decoration are live, and schedules the next changes. */
export async function syncLookSchedules(
  ctx: MutationCtx,
  row: Doc<"shopLooks">,
  published: StoredLook | undefined,
  now: number,
): Promise<{ promoLive: boolean; decorationLive: boolean }> {
  const times = new Set([
    ...promoBoundaries(published?.overrides.promo, now),
    ...promoBoundaries(published?.overrides.profile?.decoration, now),
  ]);
  for (const at of times) {
    // Jobs from an older publish just recompute the same answer.
    await ctx.scheduler.runAt(at, internal.shopLookJobs.syncSchedules, { shopId: row.shopId });
  }
  return liveFlags(published, now);
}

export const mine = sellerQuery({
  permission: "ownShop.manage",
  args: {},
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const row = await lookRow(ctx, shop._id);
    const entitled = await hasFeature(ctx, shop, "allLooks");
    const promoEntitled = await hasFeature(ctx, shop, "salesPromotions");
    const published = row?.published ?? null;
    const draft = row?.draft ?? null;
    return {
      slug: shop.slug,
      /** Default event banner texts are written in the shop's language. */
      language: shop.language,
      /** What the editor starts from. */
      editing: draft ?? published ?? FREE_LOOK,
      published,
      hasUnpublishedChanges: draft !== null && !sameLook(draft, published ?? FREE_LOOK),
      entitled,
      /** The seller's design is saved but the plan shows the free look instead. */
      hiddenByPlan: !entitled && published !== null && !isFreeLook(withoutPromo(published)),
      promoEntitled,
      /** The published event banner is saved but the plan doesn't show it. */
      promoHiddenByPlan: !promoEntitled && published?.overrides.promo !== undefined,
      /** Whether the published event banner is live now (its dates). */
      promoLive: row?.promoLive === true,
      /** Whether the published profile decoration is live now (its dates). */
      decorationLive: row?.decorationLive === true,
      /** A sale is running (and shown), so the event banner can link to it. */
      saleLive: (await liveSalesFor(ctx, shop)).length > 0,
      bannerUrls: await bannerUrls(ctx, [draft, published]),
      publishedAt: row?.publishedAt ?? null,
      draftUpdatedAt: row?.draftUpdatedAt ?? null,
      resetByAdminAt: row?.resetByAdminAt ?? null,
    };
  },
});

export const saveDraft = sellerMutation({
  permission: "ownShop.manage",
  args: { look: storedLookValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    const look = cleanLook(args.look);
    if (look === null) fail("LOOK_INVALID");
    const row = await lookRow(ctx, shop._id);

    const used = lookImageIds(look);
    await claimImages(ctx, used);
    await deleteFilesNotIn(ctx, lookImageIds(row?.draft), [...used, ...lookImageIds(row?.published)]);

    const now = Date.now();
    if (row) {
      await ctx.db.patch("shopLooks", row._id, { draft: look, draftUpdatedAt: now });
    } else {
      await ctx.db.insert("shopLooks", { shopId: shop._id, draft: look, draftUpdatedAt: now });
    }
    return null;
  },
});

export const publish = sellerMutation({
  permission: "ownShop.manage",
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const row = await lookRow(ctx, shop._id);
    if (!row?.draft) fail("LOOK_NO_DRAFT");
    const draft = row.draft;
    const now = Date.now();
    // Checks the normal banner and, if any, the event banner's text.
    if (hasBlockingProblem(lookProblems(resolveLook(draft)))) fail("LOOK_CONTRAST");
    if (!isFreeLook(withoutPromo(draft))) await requireCan(ctx, shop, { kind: "feature", feature: "allLooks" });
    const promo = draft.overrides.promo;
    if (promo) {
      await requireCan(ctx, shop, { kind: "feature", feature: "salesPromotions" });
      if (scheduleProblem(promo, now) !== null) fail("PROMO_SCHEDULE_INVALID");
    }
    // A decoration is a Pro option (isFreeLook above); its dates follow the promo rules.
    const decoration = draft.overrides.profile?.decoration;
    if (decoration && scheduleProblem(decoration, now) !== null) fail("DECORATION_SCHEDULE_INVALID");

    await deleteFilesNotIn(ctx, lookImageIds(row.published), lookImageIds(draft));
    await ctx.db.patch("shopLooks", row._id, {
      published: draft,
      draft: undefined,
      draftUpdatedAt: undefined,
      publishedAt: now,
      resetByAdminAt: undefined,
      ...(await syncLookSchedules(ctx, row, draft, now)),
    });
    return null;
  },
});

export const discardDraft = sellerMutation({
  permission: "ownShop.manage",
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const row = await lookRow(ctx, shop._id);
    if (!row?.draft) return null;
    await deleteFilesNotIn(ctx, lookImageIds(row.draft), lookImageIds(row.published));
    await ctx.db.patch("shopLooks", row._id, { draft: undefined, draftUpdatedAt: undefined });
    return null;
  },
});

/** Ends `promo` now (keeps it saved, "ended"). A start still in the future is dropped. */
function endedAt(look: StoredLook | undefined, now: number): StoredLook | undefined {
  const promo = look?.overrides.promo;
  if (!look || !promo) return look;
  const startsAt = promo.startsAt !== undefined && promo.startsAt < now ? promo.startsAt : undefined;
  return { ...look, overrides: { ...look.overrides, promo: { ...promo, startsAt, endsAt: now } } };
}

/**
 * "The sale is over": ends the published event banner at once, without a
 * publish. The draft's copy ends too, so a later publish doesn't restart it.
 * Stays saved; the seller can pick new dates and publish again.
 */
export const endPromoNow = sellerMutation({
  permission: "ownShop.manage",
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const row = await lookRow(ctx, shop._id);
    if (!row?.published?.overrides.promo) return null;
    const now = Date.now();
    await ctx.db.patch("shopLooks", row._id, {
      published: endedAt(row.published, now),
      draft: endedAt(row.draft, now),
      promoLive: false,
    });
    return null;
  },
});
