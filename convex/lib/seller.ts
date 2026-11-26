import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { loadAccess, requireAnyPermission, type Access, type PermissionArg } from "./access";
import { fail } from "./errors";
import { imageProblem } from "./images";
import { currentShopAccess, findShopByOwner, type ShopAccess } from "./shopAccess";

export { findShopByOwner };

/**
 * The wrappers every seller function uses (CLAUDE.md "Security &
 * ownership", "Team accounts"): `sellerQuery({ permission:
 * "ownProducts.manage", args, handler })`. They reject signed-out and
 * suspended callers, resolve the caller's CURRENT shop (own shop or a
 * team membership, lib/shopAccess.ts) and check the permission against
 * what the caller may do in THAT shop. They add `ctx.user`, `ctx.access`
 * (effective, shop-scoped permissions) and `ctx.shopAccess` (null before
 * the caller has any shop). Ownership is still checked by
 * `requireOwnShop` / `requireOwnProduct`.
 */
async function sellerAccess(ctx: QueryCtx, { permission }: PermissionArg, now?: number) {
  const global = await loadAccess(ctx);
  const shopAccess = await currentShopAccess(ctx, global, now);
  const access: Access = shopAccess ? { ...global, permissions: shopAccess.permissions } : global;
  requireAnyPermission(access, permission);
  return { user: global.user, access, shopAccess };
}

export const sellerQuery = customQuery(
  query,
  customCtx((ctx: QueryCtx, extra: PermissionArg) => sellerAccess(ctx, extra)),
);

/**
 * Same as `sellerQuery`, and a suspended shop is read-only: every seller
 * write (shop, products, uploads) throws SHOP_SUSPENDED. Reads still work
 * so the dashboard can explain what happened.
 */
export const sellerMutation = customMutation(
  mutation,
  customCtx(async (ctx: MutationCtx, extra: PermissionArg) => {
    const result = await sellerAccess(ctx, extra, Date.now());
    if (result.shopAccess?.shop.status === "suspended") fail("SHOP_SUSPENDED");
    return result;
  }),
);

type WithAccess<C> = C & { user: Doc<"users">; access: Access; shopAccess: ShopAccess | null };
export type SellerQueryCtx = WithAccess<QueryCtx>;
export type SellerMutationCtx = WithAccess<MutationCtx>;

/** The caller's current shop (fresh copy); throws NO_SHOP if they have none yet. */
export async function requireOwnShop(ctx: SellerQueryCtx): Promise<Doc<"shops">> {
  const shop = ctx.shopAccess ? await ctx.db.get("shops", ctx.shopAccess.shop._id) : null;
  if (!shop) fail("NO_SHOP");
  return shop;
}

/**
 * A product of the caller's current shop. Someone else's product is
 * reported as NOT_FOUND, never as forbidden, so its existence doesn't leak.
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
 * Checks each file is an acceptable image and belongs to `shop`, claiming
 * files nobody has claimed yet for that shop (CLAUDE.md "Images"): any
 * team member of the shop may attach the shop's files, nobody else. Rows
 * from before team accounts have no `shopId` and belong to the shop of
 * their uploader. Throws IMAGE_INVALID for a missing / non-image /
 * oversized file or one claimed by another shop.
 */
export async function claimImages(
  ctx: MutationCtx & { user: Doc<"users"> },
  shop: Doc<"shops">,
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
      await ctx.db.insert("uploads", { storageId, ownerId: ctx.user._id, shopId: shop._id });
      continue;
    }
    const owned = upload.shopId === undefined ? upload.ownerId === shop.ownerId : upload.shopId === shop._id;
    if (!owned) fail("IMAGE_INVALID");
  }
}

/**
 * Deletes files (and their ownership rows) that `after` no longer uses.
 * A photo still used by a recorded sale's snapshot is kept (CLAUDE.md
 * "Sales tracking"); it goes when the shop is purged.
 */
export async function deleteFilesNotIn(
  ctx: MutationCtx,
  before: readonly Id<"_storage">[],
  after: readonly Id<"_storage">[],
): Promise<void> {
  const kept = new Set<string>(after);
  for (const storageId of before) {
    if (kept.has(storageId)) continue;
    const inSale = await ctx.db
      .query("salesRecords")
      .withIndex("by_photoId", (q) => q.eq("photoId", storageId))
      .first();
    if (inSale) continue;
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
