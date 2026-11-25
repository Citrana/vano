import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { hasFeature, requireCan } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { announcementFacetValidator } from "./lib/looks/announcement";
import { cleanAnnouncement, cleanLook, lookImageIds, sameLook, withoutPromo, withPublishedBar } from "./lib/looks/clean";
import { hasBlockingProblem, lookProblems } from "./lib/looks/contrast";
import { FREE_LOOK, isFreeLook } from "./lib/looks/presets";
import { resolveLook } from "./lib/looks/resolve";
import { liveFlags, lookBoundaries, scheduleProblem, type LiveFlags } from "./lib/looks/schedule";
import { isFreeSections } from "./lib/looks/sections";
import { bannerUrls, lookRow, publicLookFor } from "./lib/looks/store";
import { liveSaleSummary, liveSalesFor } from "./lib/sales/store";
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
 *
 * Sections other than "All products" and layouts other than 2 columns
 * need `featuredSections`.
 *
 * The Promo bar (`overrides.announcement`) is edited on the Sales page and
 * saved straight away by `savePromoBar` (published and draft); the Look
 * editor's `saveDraft` / `publish` keep the published one
 * (`withPublishedBar`). It needs `announcementBar` and, like the promo, is
 * live only between its dates (`announcementLive`).
 */

/** Whether the published promo / decoration / announcement are live, and schedules the next changes. */
export async function syncLookSchedules(
  ctx: MutationCtx,
  row: Doc<"shopLooks">,
  published: StoredLook | undefined,
  now: number,
): Promise<LiveFlags> {
  for (const at of lookBoundaries(published, now)) {
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
    const sectionsEntitled = await hasFeature(ctx, shop, "featuredSections");
    const announcementEntitled = await hasFeature(ctx, shop, "announcementBar");
    const filtersEntitled = await hasFeature(ctx, shop, "shopFilters");
    const published = row?.published ?? null;
    const draft = row?.draft ?? null;
    return {
      slug: shop.slug,
      /** Default event banner texts are written in the shop's language. */
      language: shop.language,
      /** The shop's categories (the Sections editor offers a section per category). */
      categories: shop.categories,
      /** What the editor starts from. */
      editing: draft ?? published ?? FREE_LOOK,
      published,
      hasUnpublishedChanges: draft !== null && !sameLook(withPublishedBar(draft, published), published ?? FREE_LOOK),
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
      sectionsEntitled,
      /** The published sections / layout are saved but the plan shows the Free ones. */
      sectionsHiddenByPlan: !sectionsEntitled && !isFreeSections(published?.overrides.sections),
      announcementEntitled,
      /** `shopFilters`: the full customer filters (Free: category chips and sort). */
      filtersEntitled,
      /** The published announcement bar is saved but the plan doesn't show it. */
      announcementHiddenByPlan: !announcementEntitled && published?.overrides.announcement !== undefined,
      /** Whether the published announcement bar is live now (its dates). */
      announcementLive: row?.announcementLive === true,
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
    const cleaned = cleanLook(args.look);
    if (cleaned === null) fail("LOOK_INVALID");
    const row = await lookRow(ctx, shop._id);
    // The Promo bar is saved from the Sales page: keep the published one.
    const look = withPublishedBar(cleaned, row?.published);

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
    // The Promo bar is never changed by a publish (`savePromoBar` owns it).
    const draft = withPublishedBar(row.draft, row.published);
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
    if (!isFreeSections(draft.overrides.sections)) {
      await requireCan(ctx, shop, { kind: "feature", feature: "featuredSections" });
    }
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

/**
 * The Sales page's Promo bar editor: the saved bar, the look visitors see
 * (its colours for the preview), the running sale's summary (the bar's
 * real sale text) and the plan state. Nothing personal, no storage ids.
 */
export const promoBar = sellerQuery({
  permission: "ownShop.manage",
  args: {},
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const row = await lookRow(ctx, shop._id);
    const entitled = await hasFeature(ctx, shop, "announcementBar");
    const bar = row?.published?.overrides.announcement ?? null;
    return {
      slug: shop.slug,
      bar,
      entitled,
      /** Saved, but the plan doesn't show it. */
      hiddenByPlan: !entitled && bar !== null,
      /** Between its dates now. */
      live: row?.announcementLive === true,
      look: await publicLookFor(ctx, shop),
      sale: await liveSaleSummary(ctx, shop),
    };
  },
});

/**
 * Saves the Promo bar from the Sales page, live at once (no publish): into
 * the published look and the draft, so the Look editor never brings an
 * old one back. Saving one needs `announcementBar`, valid dates and
 * readable colours; removing it (null) works on every plan.
 */
export const savePromoBar = sellerMutation({
  permission: "ownShop.manage",
  args: { bar: v.union(announcementFacetValidator, v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    const row = await lookRow(ctx, shop._id);
    const now = Date.now();
    let bar = null;
    if (args.bar !== null) {
      bar = cleanAnnouncement(args.bar);
      if (bar === null) fail("LOOK_INVALID");
      await requireCan(ctx, shop, { kind: "feature", feature: "announcementBar" });
      if (scheduleProblem(bar, now) !== null) fail("ANNOUNCEMENT_SCHEDULE_INVALID");
    }
    const withBar = (look: StoredLook): StoredLook => {
      const overrides = { ...look.overrides };
      if (bar) overrides.announcement = bar;
      else delete overrides.announcement;
      return { ...look, overrides };
    };
    const published = withBar(row?.published ?? FREE_LOOK);
    if (bar && hasBlockingProblem(lookProblems(resolveLook(published)).filter((p) => p.target === "announcement"))) {
      fail("LOOK_CONTRAST");
    }
    if (!row) {
      const id = await ctx.db.insert("shopLooks", { shopId: shop._id, published, publishedAt: now });
      const inserted = await ctx.db.get("shopLooks", id);
      if (inserted) await ctx.db.patch("shopLooks", id, await syncLookSchedules(ctx, inserted, published, now));
      return null;
    }
    await ctx.db.patch("shopLooks", row._id, {
      published,
      draft: row.draft ? withBar(row.draft) : undefined,
      ...(await syncLookSchedules(ctx, row, published, now)),
    });
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
