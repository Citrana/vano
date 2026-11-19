import { v } from "convex/values";
import { hasFeature, requireCan } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { cleanLook, lookImageIds, sameLook } from "./lib/looks/clean";
import { hasBlockingProblem, lookProblems } from "./lib/looks/contrast";
import { FREE_LOOK, isFreeLook } from "./lib/looks/presets";
import { resolveLook } from "./lib/looks/resolve";
import { bannerUrls, lookRow } from "./lib/looks/store";
import { storedLookValidator } from "./lib/looks/validators";
import { claimImages, deleteFilesNotIn, requireOwnShop, sellerMutation, sellerQuery } from "./lib/seller";

/**
 * The seller's "Shop look" editor (CLAUDE.md "Shop looks"). Edits are
 * saved as a draft (any plan); `publish` makes the draft what visitors
 * see. Publishing anything but the free look needs the `allLooks` plan
 * feature, and a look with a blocking contrast problem is refused.
 * A banner photo is claimed when a draft first uses it, and deleted once
 * neither the draft nor the published look uses it.
 */

export const mine = sellerQuery({
  permission: "ownShop.manage",
  args: {},
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const row = await lookRow(ctx, shop._id);
    const entitled = await hasFeature(ctx, shop, "allLooks");
    const published = row?.published ?? null;
    const draft = row?.draft ?? null;
    return {
      slug: shop.slug,
      /** What the editor starts from. */
      editing: draft ?? published ?? FREE_LOOK,
      published,
      hasUnpublishedChanges: draft !== null && !sameLook(draft, published ?? FREE_LOOK),
      entitled,
      /** The seller's design is saved but the plan shows the free look instead. */
      hiddenByPlan: !entitled && published !== null && !isFreeLook(published),
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
    if (hasBlockingProblem(lookProblems(resolveLook(draft)))) fail("LOOK_CONTRAST");
    if (!isFreeLook(draft)) await requireCan(ctx, shop, { kind: "feature", feature: "allLooks" });

    await deleteFilesNotIn(ctx, lookImageIds(row.published), lookImageIds(draft));
    await ctx.db.patch("shopLooks", row._id, {
      published: draft,
      draft: undefined,
      draftUpdatedAt: undefined,
      publishedAt: Date.now(),
      resetByAdminAt: undefined,
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
