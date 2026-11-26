import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { audienceValidator, categoryValidator, cleanTags, conditionValidator, LIMITS, tagsProblem } from "./lib/catalog";
import { hasPermission } from "./lib/access";
import { normalizeProductCode, productCodeProblem, suggestProductCode } from "./lib/productCode";
import { fail } from "./lib/errors";
import { urlOf } from "./lib/images";
import { costPriceProblem, priceProblem } from "./lib/money";
import { onProductCreated } from "./lib/platformStats";
import { deleteProduct } from "./lib/productWrites";
import { applyStock, piecesTracked, stockUpdate } from "./lib/productStock";
import { isTracked, piecesProblem, stockFlags } from "./lib/stock";
import { canShopDo, getEntitlements, hiddenFromShop, requireCan, shopProducts, visibleProductIds } from "./lib/entitlements";
import { logShopActivity } from "./lib/shopActivity";
import type { ActivityKind } from "./lib/team";
import {
  claimImages,
  deleteFilesNotIn,
  requireOwnProduct,
  requireOwnShop,
  sellerMutation,
  sellerQuery,
  type SellerMutationCtx,
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
  /**
   * Pieces in stock (lib/stock.ts), required on every plan (at least 1 for a
   * new product). It drives "Few left" / "Sold out" only with `stockManagement`.
   */
  pieces: v.number(),
  /** What the seller paid per piece, minor units, 0 or more. Private. */
  costPrice: v.number(),
  condition: v.optional(conditionValidator),
  audience: v.optional(audienceValidator),
  /** Product code as typed ("" or missing = none); normalised and checked here. */
  code: v.optional(v.string()),
});
type ProductInput = Infer<typeof productInput>;

function cleanProductInput(shop: Doc<"shops">, input: ProductInput, options: { creating: boolean }): ProductInput {
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
  if (piecesProblem(input.pieces, options) !== null) fail("STOCK_INVALID");
  if (costPriceProblem(input.costPrice) !== null) fail("COST_PRICE_INVALID");
  const code = input.code === undefined ? "" : normalizeProductCode(input.code);
  if (code !== "" && productCodeProblem(code) !== null) fail("PRODUCT_CODE_INVALID");
  return {
    name,
    price: input.price,
    category: input.category,
    description,
    sizes,
    colors,
    imageIds,
    soldOut: input.soldOut,
    pieces: input.pieces,
    costPrice: input.costPrice,
    condition: input.condition,
    audience: input.audience,
    code: code || undefined,
  };
}

/** A product code is unique per shop (case insensitive: codes are stored normalised). */
async function assertCodeFree(ctx: SellerMutationCtx, shop: Doc<"shops">, code: string | undefined, self?: Id<"products">) {
  if (code === undefined) return;
  const holder = await ctx.db
    .query("products")
    .withIndex("by_shopId_and_code", (q) => q.eq("shopId", shop._id).eq("code", code))
    .first();
  if (holder && holder._id !== self) fail("PRODUCT_CODE_TAKEN");
}

/**
 * The labels the form's pieces drive. The count is stored on every plan;
 * with `stockManagement` it decides "Few left" / "Sold out", without it
 * it's kept but not used (the form's Sold out switch applies).
 */
async function stockFromForm(
  ctx: SellerMutationCtx,
  shop: Doc<"shops">,
  input: ProductInput,
): Promise<{ tracked: boolean; soldOut: boolean; fewLeft: boolean | undefined }> {
  const { limits } = await getEntitlements(ctx, shop, Date.now());
  const canTrack = canShopDo(limits, { kind: "feature", feature: "stockManagement" }) === null;
  if (!canTrack) return { tracked: false, soldOut: input.soldOut, fewLeft: undefined };
  const flags = stockFlags(input.pieces);
  return { tracked: true, soldOut: flags.soldOut, fewLeft: flags.fewLeft || undefined };
}

/**
 * The caller's products, newest first, with cover image. `overLimit`
 * marks products the public shop doesn't show because the shop has more
 * than its plan allows; `pinned` ones are kept visible by the seller.
 */
export const listMine = sellerQuery({
  permission: "ownProducts.view",
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
        overLimit: !hiddenFromShop(p) && !visible.has(p._id),
        pinned: p.pinnedAt !== undefined,
        featured: p.featured === true,
        fewLeft: p.fewLeft === true,
        backInStock: p.backInStock === true,
        hiddenBySeller: p.hiddenBySeller === true,
        pieces: p.pieces ?? null,
        tracked: isTracked(p, limits),
        code: p.code ?? null,
        imageCount: p.imageIds.length,
        coverUrl: await urlOf(ctx, p.imageIds[0]),
      })),
    );
  },
});

/**
 * One of the caller's products for the edit form, or null (bad id / not
 * theirs). The cost price is private: only for callers who can edit
 * products (`ownProducts.manage`).
 */
export const getMine = sellerQuery({
  permission: "ownProducts.view",
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
    const { costPrice, ...rest } = product;
    const canSeeCost = hasPermission(ctx.access, "ownProducts.manage");
    return { ...rest, costPrice: canSeeCost ? costPrice : undefined, images };
  },
});

/**
 * A free product code for a category ("CLO-004": its prefix and the next
 * running number, lib/productCode.ts). The seller may edit it; saving
 * checks it's still free.
 */
export const suggestCode = sellerQuery({
  permission: "ownProducts.manage",
  args: { category: categoryValidator },
  returns: v.string(),
  handler: async (ctx, { category }) => {
    const shop = await requireOwnShop(ctx);
    const products = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
      .take(LIMITS.maxProducts);
    return suggestProductCode(
      category,
      products.flatMap((p) => (p.code ? [p.code] : [])),
    );
  },
});

/** One line in the shop's activity history (CLAUDE.md "Team accounts"). */
async function logProduct(
  ctx: SellerMutationCtx,
  shop: Pick<Doc<"shops">, "_id">,
  kind: ActivityKind,
  product: Pick<Doc<"products">, "_id" | "name">,
) {
  await logShopActivity(ctx, shop, { actor: ctx.user, kind, targetId: product._id, targetLabel: product.name });
}

export const create = sellerMutation({
  permission: "ownProducts.manage",
  args: productInput.fields,
  returns: v.id("products"),
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    const input = cleanProductInput(shop, args, { creating: true });
    await assertCodeFree(ctx, shop, input.code);
    const existing = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
      .take(LIMITS.maxProducts);
    if (existing.length >= LIMITS.maxProducts) fail("TOO_MANY_PRODUCTS");
    await requireCan(ctx, shop, { kind: "addProduct", products: existing.length });
    await requireCan(ctx, shop, { kind: "setPhotos", count: input.imageIds.length });
    const stock = await stockFromForm(ctx, shop, input);
    await claimImages(ctx, shop, input.imageIds);
    const productId = await ctx.db.insert("products", {
      ...input,
      soldOut: stock.soldOut,
      fewLeft: stock.fewLeft,
      shopId: shop._id,
      updatedAt: Date.now(),
    });
    await onProductCreated(ctx, (await ctx.db.get("products", productId))!);
    await logProduct(ctx, shop, "product.created", { _id: productId, name: input.name });
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
    // Pieces and cost price are required here too, so an older product
    // without them gets them on its first save (CLAUDE.md "Sales tracking").
    const input = cleanProductInput(shop, args, { creating: false });
    await assertCodeFree(ctx, shop, input.code, productId);
    await requireCan(ctx, shop, {
      kind: "setPhotos",
      count: input.imageIds.length,
      previousCount: product.imageIds.length,
    });
    const known = new Set<string>(product.imageIds);
    await claimImages(
      ctx,
      shop,
      input.imageIds.filter((id) => !known.has(id)),
    );
    await deleteFilesNotIn(ctx, product.imageIds, input.imageIds);
    // `hidden` (admin), `pinnedAt`, `featured` and the stock labels (own
    // actions) aren't form fields; carry them over or `replace` would drop
    // them. Turning "Sold out" off here also marks it back in stock.
    const now = Date.now();
    const counted = await stockFromForm(ctx, shop, input);
    const stock = await stockUpdate(ctx, product, counted.soldOut, now, { byUserId: ctx.user._id });
    await ctx.db.replace("products", productId, {
      ...input,
      ...stock,
      ...(counted.tracked ? { fewLeft: counted.fewLeft } : {}),
      shopId: shop._id,
      hidden: product.hidden,
      hiddenBySeller: product.hiddenBySeller,
      pinnedAt: product.pinnedAt,
      featured: product.featured,
      updatedAt: now,
    });
    await logProduct(ctx, shop, "product.updated", { _id: productId, name: input.name });
    return null;
  },
});

export const setSoldOut = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products"), soldOut: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, soldOut }) => {
    const { shop, product } = await requireOwnProduct(ctx, productId);
    if (await piecesTracked(ctx, shop, product)) fail("STOCK_TRACKED");
    if (product.soldOut === soldOut) return null;
    await applyStock(ctx, product, soldOut, Date.now(), { byUserId: ctx.user._id });
    await logProduct(ctx, shop, soldOut ? "product.soldOut" : "product.backOnSale", product);
    return null;
  },
});

/** Shows the product in the shop's "Featured" section (when the seller turns it on). */
export const setFeatured = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products"), featured: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, featured }) => {
    const { shop, product } = await requireOwnProduct(ctx, productId);
    if ((product.featured === true) === featured) return null;
    await ctx.db.patch("products", productId, { featured: featured || undefined });
    await logProduct(ctx, shop, featured ? "product.featured" : "product.unfeatured", product);
    return null;
  },
});

/** The "Few left" label (a switch: there's no stock count). Not for a sold-out product. */
export const setFewLeft = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products"), fewLeft: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, fewLeft }) => {
    const { shop, product } = await requireOwnProduct(ctx, productId);
    if (await piecesTracked(ctx, shop, product)) fail("STOCK_TRACKED");
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
      const pinnedCount = products.filter((p) => p.pinnedAt !== undefined && !hiddenFromShop(p)).length;
      await requireCan(ctx, shop, { kind: "pinProduct", pinned: pinnedCount });
    }
    await ctx.db.patch("products", productId, { pinnedAt: pinned ? Date.now() : undefined });
    return null;
  },
});

/**
 * Hides a product from the shop, or shows it again (the seller's own
 * switch, any plan; e.g. "Hide product" on a sold-out notification). An
 * admin's hide (`hidden`) stays: the seller can't undo it.
 */
export const setHiddenBySeller = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, hidden }) => {
    const { shop, product } = await requireOwnProduct(ctx, productId);
    if ((product.hiddenBySeller === true) === hidden) return null;
    await ctx.db.patch("products", productId, { hiddenBySeller: hidden || undefined, updatedAt: Date.now() });
    await logProduct(ctx, shop, hidden ? "product.hidden" : "product.shown", product);
    return null;
  },
});

/** Whether the seller hid one of their products (the notification's Hide / Show button); null if gone. */
export const visibility = sellerQuery({
  permission: "ownProducts.view",
  args: { productId: v.string() },
  handler: async (ctx, { productId }) => {
    const shop = await requireOwnShop(ctx);
    const id = ctx.db.normalizeId("products", productId);
    const product = id ? await ctx.db.get("products", id) : null;
    if (!product || product.shopId !== shop._id) return null;
    return { hiddenBySeller: product.hiddenBySeller === true, hiddenByAdmin: product.hidden === true };
  },
});

/** Deletes the product, its images and its stats rows. */
export const remove = sellerMutation({
  permission: "ownProducts.manage",
  args: { productId: v.id("products") },
  returns: v.null(),
  handler: async (ctx, { productId }) => {
    const { shop, product } = await requireOwnProduct(ctx, productId);
    await deleteProduct(ctx, product, ctx.user._id);
    await logProduct(ctx, shop, "product.deleted", product);
    return null;
  },
});
