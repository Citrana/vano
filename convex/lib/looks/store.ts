import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { hasFeature } from "../entitlements";
import { deleteFilesNotIn } from "../seller";
import { lookImageIds, shownLook } from "./clean";
import { mapBannerImage, resolveLook, type ResolvedLook } from "./resolve";
import type { StoredLook } from "./validators";

/**
 * Server-side access to `shopLooks` (CLAUDE.md "Shop looks"). The public
 * pages get a `PublicLook`: resolved tokens + the banner photo's URL,
 * never the draft or any storage id.
 */

/** A resolved look whose banner photo is a URL. */
export type PublicLook = ResolvedLook<string>;

export async function lookRow(ctx: QueryCtx, shopId: Id<"shops">): Promise<Doc<"shopLooks"> | null> {
  return await ctx.db
    .query("shopLooks")
    .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
    .unique();
}

/** Resolves a stored look and swaps its banner photo for a URL. */
export async function resolveWithUrl(ctx: QueryCtx, look: StoredLook): Promise<PublicLook> {
  const resolved = resolveLook(look);
  const [imageId] = lookImageIds(look);
  const url = imageId ? await ctx.storage.getUrl(imageId) : null;
  return mapBannerImage(resolved, () => url);
}

/**
 * What visitors see (`shownLook`): the published look when the plan
 * includes `allLooks`, else the free look with the Free parts of the saved
 * profile (CLAUDE.md "Billing": a downgrade never deletes the design, it
 * only stops showing it). Its event & promo banner shows only while live
 * (`promoLive`) and while the plan includes `salesPromotions`; the profile
 * decoration only while live (`decorationLive`).
 */
export async function visibleLook(ctx: QueryCtx, shop: Doc<"shops">): Promise<StoredLook> {
  const row = await lookRow(ctx, shop._id);
  return shownLook(row?.published, {
    entitled: await hasFeature(ctx, shop, "allLooks"),
    promoShown: row?.promoLive === true && (await hasFeature(ctx, shop, "salesPromotions")),
    decorationShown: row?.decorationLive === true,
  });
}

export async function publicLookFor(ctx: QueryCtx, shop: Doc<"shops">): Promise<PublicLook> {
  return await resolveWithUrl(ctx, await visibleLook(ctx, shop));
}

/** Storage URLs for the banner photos of the given looks, keyed by id. */
export async function bannerUrls(
  ctx: QueryCtx,
  looks: readonly (StoredLook | null | undefined)[],
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (const id of new Set(looks.flatMap(lookImageIds))) {
    const url = await ctx.storage.getUrl(id);
    if (url) urls[id] = url;
  }
  return urls;
}

/** Deletes a shop's look and its banner photos (shop deletion). */
export async function deleteShopLook(ctx: MutationCtx, shopId: Id<"shops">): Promise<void> {
  const row = await lookRow(ctx, shopId);
  if (!row) return;
  await deleteFilesNotIn(ctx, [...lookImageIds(row.draft), ...lookImageIds(row.published)], []);
  await ctx.db.delete("shopLooks", row._id);
}
