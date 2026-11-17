import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { LIMITS } from "./lib/catalog";
import { urlOf, urlsOf } from "./lib/images";

/**
 * Unauthenticated reads for the public shop pages. They never return
 * `ownerId` or anything personal about the seller beyond what the seller
 * chose to publish (CLAUDE.md "Security & ownership").
 */

async function publicShop(ctx: QueryCtx, shop: Doc<"shops">) {
  return {
    _id: shop._id,
    name: shop.name,
    slug: shop.slug,
    currency: shop.currency,
    language: shop.language,
    categories: shop.categories,
    description: shop.description ?? null,
    whatsappNumber: shop.whatsappNumber,
    city: shop.city,
    country: shop.country,
    logoUrl: await urlOf(ctx, shop.logoId),
  };
}

async function shopFromSlug(ctx: QueryCtx, slug: string) {
  return await ctx.db
    .query("shops")
    .withIndex("by_slug", (q) => q.eq("slug", slug.toLowerCase()))
    .unique();
}

/** Just the shop's public fields (no products), or null. Cheap existence check. */
export const shopBasics = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const shop = await shopFromSlug(ctx, slug);
    return shop ? await publicShop(ctx, shop) : null;
  },
});

/** The shop page: shop + its products (newest first). Null for an unknown slug. */
export const shopBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const shop = await shopFromSlug(ctx, slug);
    if (!shop) return null;
    const products = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
      .order("desc")
      .take(LIMITS.maxProducts);
    return {
      shop: await publicShop(ctx, shop),
      products: await Promise.all(
        products.map(async (p) => ({
          _id: p._id,
          name: p.name,
          price: p.price,
          category: p.category,
          soldOut: p.soldOut,
          coverUrl: await urlOf(ctx, p.imageIds[0]),
        })),
      ),
    };
  },
});

/**
 * The product page. `productId` is a plain string so a mistyped URL
 * returns null (→ 404) instead of failing validation. The product must
 * belong to the shop named in the URL.
 */
export const productForPage = query({
  args: { slug: v.string(), productId: v.string() },
  handler: async (ctx, { slug, productId }) => {
    const shop = await shopFromSlug(ctx, slug);
    if (!shop) return null;
    const id = ctx.db.normalizeId("products", productId);
    const product = id ? await ctx.db.get("products", id) : null;
    if (!product || product.shopId !== shop._id) return null;
    return {
      shop: await publicShop(ctx, shop),
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        category: product.category,
        description: product.description ?? null,
        sizes: product.sizes,
        colors: product.colors,
        soldOut: product.soldOut,
        imageUrls: await urlsOf(ctx, product.imageIds),
      },
    };
  },
});
