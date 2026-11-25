import { v, type Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { categoryValidator, cleanTags, LIMITS, tagsProblem } from "./lib/catalog";
import { fail } from "./lib/errors";
import { urlOf } from "./lib/images";
import { priceProblem } from "./lib/money";
import { onProductCreated } from "./lib/platformStats";
import { deleteProduct } from "./lib/productWrites";
import { applyStock, stockUpdate } from "./lib/productStock";
import { getEntitlements, requireCan, shopProducts, visibleProductIds } from "./lib/entitlements";
import {
  claimImages,
  deleteFilesNotIn,
  requireOwnProduct,
  requireOwnShop,
  sellerMutation,
  sellerQuery,
} from "./lib/seller";

const productInput = v.object({
  name: v.string(),
  /** Integer minor units, in the shop's currency. */
  price: v.number(),
  category: categoryValidator,
  description: v.optional(v.string()),
  sizes: v.array(v.string()),
  colors: v.array(v.string()),
  imageIds: v.array(v.id("_storage")),
  soldOut: v.boolean(),
});
type ProductInput = Infer<typeof productInput>;

function cleanProductInput(shop: Doc<"shops">, input: ProductInput): ProductInput {
  const name = input.name.trim();
  if (name.length < LIMITS.productNameMin || name.length > LIMITS.productNameMax) {
    fail("NAME_INVALID");
  }
  if (priceProblem(input.price) !== null) fail("PRICE_INVALID");
  if (!shop.categories.includes(input.category)) fail("CATEGORY_NOT_IN_SHOP");

  const description = input.description?.trim() || undefined;
  if (description && description.length > LIMITS.productDescriptionMax) {
    fail("DESCRIPTION_TOO_LONG");
  }
  const sizes = cleanTags(input.sizes);
  const colors = cleanTags(input.colors);
  if (tagsProblem(sizes) !== null || tagsProblem(colors) !== null) fail("TAGS_INVALID");

  const imageIds = [...new Set(input.imageIds)];
  if (imageIds.length < LIMITS.minImages || imageIds.length > LIMITS.maxImages) {
    fail("IMAGES_COUNT");
  }
  return {
    name,
    price: input.price,
    category: input.category,
    description,
    sizes,
    colors,
    imageIds,
    soldOut: input.soldOut,
  };
}

/**
 * The caller's products, newest first, with cover image. `overLimit`
 * marks products the public shop doesn't show because the shop has more
 * than its plan allows; `pinned` ones are kept visible by the seller.
 */
export const listMine = sellerQuery({
  permission: "ownProducts.manage",
  args: {},
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const products = await shopProducts(ctx, shop._id);
    const { limits } = await getEntitlements(ctx, shop);
    const visible = visibleProductIds(products, limits);
    return await Promise.all(
      products.map(async (p) => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        category: p.category,
        soldOut: p.soldOut,
        hidden: p.hidden ?? false,
        overLimit: !p.hidden && !visible.has(p._id),
        pinned: p.pinnedAt !== undefined,
        featured: p.featured === true,
        fewLeft: p.fewLeft === true,
        backInStock: p.backInStock === true,
        imageCount: p.imageIds.length,
        coverUrl: await urlOf(ctx, p.imageIds[0]),
      })),
    );
  },
});

/** One of the caller's products for the edit form, or null (bad id / not theirs). */
export const getMine = sellerQuery({
  permission: "ownProducts.manage",
  args: { productId: v.string() },
  handler: async (ctx, { productId }) => {
    const shop = await requireOwnShop(ctx);
    const id = ctx.db.normalizeId("products", productId);
    const product = id ? await ctx.db.get("products", id) : null;
    if (!product || product.shopId !== shop._id) return null;
    const images = await Promise.all(
      product.imageIds.map(async (storageId) => ({
        storageId,
        url: await ctx.storage.getUrl(storageId),
      })),
    );
    return { ...product, images };
  },
});

export const create = sellerMutation({
  permission: "ownProducts.manage",
  args: productInput.fields,
  returns: v.id("products"),
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    const input = cleanProductInput(shop, args);
    const existing = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
      .take(LIMITS.maxProducts);
    if (existing.length >= LIMITS.maxProducts) fail("TOO_MANY_PRODUCTS");
    await requireCan(ctx, shop, { kind: "addProduct", products: existing.length });
    await requireCan(ctx, shop, { kind: "setPhotos", count: input.imageIds.length });
    await claimImages(ctx, input.imageIds);
    const productId = await ctx.db.insert("products", {
      ...input,
      shopId: shop._id,
      updatedAt: Date.now(),
    });
    await onProductCreated(ctx, (await ctx.db.get("products", productId))!);
    return productId;
  },
});

/** Saves a product; images dropped from the list are deleted from storage. */
export const update = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products"), ...productInput.fields },
  returns: v.null(),
  handler: async (ctx, { productId, ...args }) => {
    const { shop, product } = await requireOwnProduct(ctx, productId);
    const input = cleanProductInput(shop, args);
    await requireCan(ctx, shop, {
      kind: "setPhotos",
      count: input.imageIds.length,
      previousCount: product.imageIds.length,
    });
    const known = new Set<string>(product.imageIds);
    await claimImages(
      ctx,
      input.imageIds.filter((id) => !known.has(id)),
    );
    await deleteFilesNotIn(ctx, product.imageIds, input.imageIds);
    // `hidden` (admin), `pinnedAt`, `featured` and the stock labels (own
    // actions) aren't form fields; carry them over or `replace` would drop
    // them. Turning "Sold out" off here also marks it back in stock.
    const now = Date.now();
    const stock = await stockUpdate(ctx, product, input.soldOut, now, { byUserId: ctx.user._id });
    await ctx.db.replace("products", productId, {
      ...input,
      ...stock,
      shopId: shop._id,
      hidden: product.hidden,
      pinnedAt: product.pinnedAt,
      featured: product.featured,
      updatedAt: now,
    });
    return null;
  },
});

export const setSoldOut = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products"), soldOut: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, soldOut }) => {
    const { product } = await requireOwnProduct(ctx, productId);
    await applyStock(ctx, product, soldOut, Date.now(), { byUserId: ctx.user._id });
    return null;
  },
});

/** Shows the product in the shop's "Featured" section (when the seller turns it on). */
export const setFeatured = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products"), featured: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, featured }) => {
    await requireOwnProduct(ctx, productId);
    await ctx.db.patch("products", productId, { featured: featured || undefined });
    return null;
  },
});

/** The "Few left" label (a switch: there's no stock count). Not for a sold-out product. */
export const setFewLeft = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products"), fewLeft: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, fewLeft }) => {
    const { product } = await requireOwnProduct(ctx, productId);
    if (fewLeft && product.soldOut) return null;
    await ctx.db.patch("products", productId, { fewLeft: fewLeft || undefined, updatedAt: Date.now() });
    return null;
  },
});

/**
 * Keeps a product visible in the public shop while the shop is over its
 * plan's product limit (or stops doing so). Pinning more products than
 * the plan allows is refused: the seller unpins one first.
 */
export const setPinned = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products"), pinned: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, pinned }) => {
    const { shop, product } = await requireOwnProduct(ctx, productId);
    if (pinned === (product.pinnedAt !== undefined)) return null;
    if (pinned) {
      const products = await shopProducts(ctx, shop._id);
      const pinnedCount = products.filter((p) => p.pinnedAt !== undefined && !p.hidden).length;
      await requireCan(ctx, shop, { kind: "pinProduct", pinned: pinnedCount });
    }
    await ctx.db.patch("products", productId, { pinnedAt: pinned ? Date.now() : undefined });
    return null;
  },
});

/** Deletes the product, its images and its stats rows. */
export const remove = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products") },
  returns: v.null(),
  handler: async (ctx, { productId }) => {
    const { product } = await requireOwnProduct(ctx, productId);
    await deleteProduct(ctx, product, ctx.user._id);
    return null;
  },
});
