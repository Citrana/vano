import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { accessWith, type Access, type PermissionArg } from "./access";
import { fail } from "./errors";
import { imageProblem } from "./images";

/**
 * The wrappers every seller function uses (CLAUDE.md "Security &
 * ownership"): `sellerQuery({ permission: "ownProducts.manage", args,
 * handler })`. They reject signed-out and suspended callers and callers
 * without the permission, and add `ctx.user` / `ctx.access`. Ownership is
 * still checked by `requireOwnShop` / `requireOwnProduct`.
 */
export const sellerQuery = customQuery(
  query,
  customCtx((ctx: QueryCtx, extra: PermissionArg) => accessWith(ctx, extra)),
);

export const sellerMutation = customMutation(
  mutation,
  customCtx((ctx: MutationCtx, extra: PermissionArg) => accessWith(ctx, extra)),
);

type WithAccess<C> = C & { user: Doc<"users">; access: Access };
export type SellerQueryCtx = WithAccess<QueryCtx>;
export type SellerMutationCtx = WithAccess<MutationCtx>;

export async function findShopByOwner(
  ctx: QueryCtx,
  ownerId: Id<"users">,
): Promise<Doc<"shops"> | null> {
  return await ctx.db
    .query("shops")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
}

/** The caller's shop; throws NO_SHOP if they haven't created one yet. */
export async function requireOwnShop(ctx: SellerQueryCtx): Promise<Doc<"shops">> {
  const shop = await findShopByOwner(ctx, ctx.user._id);
  if (!shop) fail("NO_SHOP");
  return shop;
}

/**
 * A product of the caller's shop. Someone else's product is reported as
 * NOT_FOUND, never as forbidden, so its existence doesn't leak.
 */
export async function requireOwnProduct(
  ctx: SellerQueryCtx,
  productId: Id<"products">,
): Promise<{ shop: Doc<"shops">; product: Doc<"products"> }> {
  const shop = await requireOwnShop(ctx);
  const product = await ctx.db.get("products", productId);
  if (!product || product.shopId !== shop._id) fail("NOT_FOUND");
  return { shop, product };
}

/**
 * Checks each file is an acceptable image and belongs to the caller,
 * claiming files nobody has claimed yet (CLAUDE.md "Images"). Throws
 * IMAGE_INVALID for a missing / non-image / oversized file or one claimed
 * by another seller.
 */
export async function claimImages(
  ctx: SellerMutationCtx,
  ids: readonly Id<"_storage">[],
): Promise<void> {
  for (const storageId of ids) {
    const meta = await ctx.db.system.get("_storage", storageId);
    if (imageProblem(meta) !== null) fail("IMAGE_INVALID");
    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    if (upload === null) {
      await ctx.db.insert("uploads", { storageId, ownerId: ctx.user._id });
    } else if (upload.ownerId !== ctx.user._id) {
      fail("IMAGE_INVALID");
    }
  }
}

/** Deletes files (and their ownership rows) that `after` no longer uses. */
export async function deleteFilesNotIn(
  ctx: MutationCtx,
  before: readonly Id<"_storage">[],
  after: readonly Id<"_storage">[],
): Promise<void> {
  const kept = new Set<string>(after);
  for (const storageId of before) {
    if (kept.has(storageId)) continue;
    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    if (upload) await ctx.db.delete("uploads", upload._id);
    if (await ctx.db.system.get("_storage", storageId)) {
      await ctx.storage.delete(storageId);
    }
  }
}
