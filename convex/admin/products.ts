import { paginationOptsValidator, paginationResultValidator, type PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { categoryValidator, type Category } from "../lib/catalog";
import { fail } from "../lib/errors";
import { urlOf } from "../lib/images";
import { currencyValidator } from "../lib/money";
import { shopStatusValidator } from "../lib/permissions";
import { deleteProduct } from "../lib/productWrites";

/**
 * Admin products section (CLAUDE.md "Roles & permissions"). A hidden
 * product is invisible to customers; its seller can't unhide it.
 */

const visibilityValidator = v.union(v.literal("visible"), v.literal("hidden"));

const productRow = v.object({
  _id: v.id("products"),
  name: v.string(),
  price: v.number(),
  category: categoryValidator,
  soldOut: v.boolean(),
  hidden: v.boolean(),
  coverUrl: v.union(v.string(), v.null()),
  createdAt: v.number(),
  shop: v.object({
    _id: v.id("shops"),
    name: v.string(),
    slug: v.string(),
    status: shopStatusValidator,
    currency: currencyValidator,
  }),
});

function pageOfProducts(
  ctx: QueryCtx,
  args: {
    paginationOpts: { numItems: number; cursor: string | null };
    search?: string;
    visibility?: "visible" | "hidden";
    category?: Category;
  },
): Promise<PaginationResult<Doc<"products">>> {
  const { paginationOpts, category } = args;
  const hidden = args.visibility === undefined ? undefined : args.visibility === "hidden";
  const search = args.search?.trim();
  if (search) {
    return ctx.db
      .query("products")
      .withSearchIndex("search_name", (q) => {
        const s = q.search("name", search);
        if (hidden !== undefined && category) return s.eq("hidden", hidden).eq("category", category);
        if (hidden !== undefined) return s.eq("hidden", hidden);
        if (category) return s.eq("category", category);
        return s;
      })
      .paginate(paginationOpts);
  }
  if (hidden !== undefined) {
    return ctx.db
      .query("products")
      .withIndex("by_hidden_and_category", (q) =>
        category ? q.eq("hidden", hidden).eq("category", category) : q.eq("hidden", hidden),
      )
      .order("desc")
      .paginate(paginationOpts);
  }
  if (category) {
    return ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("category", category))
      .order("desc")
      .paginate(paginationOpts);
  }
  return ctx.db.query("products").order("desc").paginate(paginationOpts);
}

/**
 * All products, newest first (or by relevance when searching the name).
 * Products of a shop being deleted are skipped, so a page can be short.
 * Products not migrated yet (no `hidden`) only appear under "all".
 */
export const list = adminQuery({
  permission: "products.view",
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    visibility: v.optional(visibilityValidator),
    category: v.optional(categoryValidator),
  },
  returns: paginationResultValidator(productRow),
  handler: async (ctx, args) => {
    const result = await pageOfProducts(ctx, args);
    const rows = await Promise.all(
      result.page.map(async (p) => {
        const shop = await ctx.db.get("shops", p.shopId);
        if (!shop) return null;
        return {
          _id: p._id,
          name: p.name,
          price: p.price,
          category: p.category,
          soldOut: p.soldOut,
          hidden: p.hidden ?? false,
          coverUrl: await urlOf(ctx, p.imageIds[0]),
          createdAt: p._creationTime,
          shop: {
            _id: shop._id,
            name: shop.name,
            slug: shop.slug,
            status: shop.status ?? ("active" as const),
            currency: shop.currency,
          },
        };
      }),
    );
    return { ...result, page: rows.filter((row) => row !== null) };
  },
});

async function productAndShop(ctx: QueryCtx, productId: Doc<"products">["_id"]) {
  const product = await ctx.db.get("products", productId);
  if (!product) fail("NOT_FOUND");
  const shop = await ctx.db.get("shops", product.shopId);
  return { product, label: `${product.name} — ${shop ? `${shop.name} (/${shop.slug})` : "?"}` };
}

/** Hides or unhides a product. No-op if nothing changes. */
export const setHidden = adminMutation({
  permission: "products.hide",
  args: { productId: v.id("products"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, hidden }) => {
    const { product, label } = await productAndShop(ctx, productId);
    if ((product.hidden ?? false) === hidden) return null;
    await ctx.db.patch("products", productId, { hidden });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: hidden ? "product.hide" : "product.unhide",
      targetType: "product",
      targetId: productId,
      targetLabel: label,
    });
    return null;
  },
});

/** Deletes a product with its photos and stats (same clean-up as the seller's delete). */
export const remove = adminMutation({
  permission: "products.delete",
  args: { productId: v.id("products") },
  returns: v.null(),
  handler: async (ctx, { productId }) => {
    const { product, label } = await productAndShop(ctx, productId);
    await deleteProduct(ctx, product);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "product.delete",
      targetType: "product",
      targetId: productId,
      targetLabel: label,
    });
    return null;
  },
});
