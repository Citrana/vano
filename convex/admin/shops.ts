import { filter } from "convex-helpers/server/filter";
import { paginationOptsValidator, paginationResultValidator, type PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { adminQuery } from "../lib/access";
import { categoryValidator, languageValidator, LIMITS, type Category } from "../lib/catalog";
import { urlOf } from "../lib/images";
import { currencyValidator, type Currency } from "../lib/money";
import { shopStatusValidator } from "../lib/permissions";

/**
 * Admin shops section (CLAUDE.md "Roles & permissions"). Reads need
 * `shops.view`; setStatus / remove (below) need `shops.suspend` /
 * `shops.delete`. Shops not migrated yet (no status) count as active.
 */

type ShopStatus = "active" | "suspended";

const shopRow = v.object({
  _id: v.id("shops"),
  name: v.string(),
  slug: v.string(),
  status: shopStatusValidator,
  currency: currencyValidator,
  categories: v.array(categoryValidator),
  city: v.string(),
  country: v.string(),
  ownerEmail: v.string(),
  createdAt: v.number(),
});

function pageOfShops(
  ctx: QueryCtx,
  args: {
    paginationOpts: { numItems: number; cursor: string | null };
    search?: string;
    status?: ShopStatus;
    currency?: Currency;
    category?: Category;
  },
): Promise<PaginationResult<Doc<"shops">>> {
  const { paginationOpts, status, currency, category } = args;
  const search = args.search?.trim();
  const base = (() => {
    if (search) {
      return ctx.db.query("shops").withSearchIndex("search_name", (q) => {
        const s = q.search("name", search);
        if (status && currency) return s.eq("status", status).eq("currency", currency);
        if (status) return s.eq("status", status);
        if (currency) return s.eq("currency", currency);
        return s;
      });
    }
    if (status) {
      return ctx.db
        .query("shops")
        .withIndex("by_status_and_currency", (q) =>
          currency ? q.eq("status", status).eq("currency", currency) : q.eq("status", status),
        )
        .order("desc");
    }
    if (currency) {
      return ctx.db
        .query("shops")
        .withIndex("by_currency", (q) => q.eq("currency", currency))
        .order("desc");
    }
    return ctx.db.query("shops").order("desc");
  })();
  // Categories are an array (not indexable): filtered while paginating, so
  // a page can come back shorter than asked.
  const query = category ? filter(base, (shop) => shop.categories.includes(category)) : base;
  return query.paginate(paginationOpts);
}

async function ownerEmail(ctx: QueryCtx, ownerId: Id<"users">): Promise<string> {
  return (await ctx.db.get("users", ownerId))?.email ?? "";
}

/** Shops, newest first (or by relevance when searching the name). */
export const list = adminQuery({
  permission: "shops.view",
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(shopStatusValidator),
    currency: v.optional(currencyValidator),
    category: v.optional(categoryValidator),
  },
  returns: paginationResultValidator(shopRow),
  handler: async (ctx, args) => {
    const result = await pageOfShops(ctx, args);
    const page = await Promise.all(
      result.page.map(async (shop) => ({
        _id: shop._id,
        name: shop.name,
        slug: shop.slug,
        status: shop.status ?? ("active" as const),
        currency: shop.currency,
        categories: shop.categories,
        city: shop.city,
        country: shop.country,
        ownerEmail: await ownerEmail(ctx, shop.ownerId),
        createdAt: shop._creationTime,
      })),
    );
    return { ...result, page };
  },
});

/** One shop for the details page, or null for an unknown / mistyped id. */
export const get = adminQuery({
  permission: "shops.view",
  args: { shopId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("shops"),
      name: v.string(),
      slug: v.string(),
      status: shopStatusValidator,
      currency: currencyValidator,
      language: languageValidator,
      categories: v.array(categoryValidator),
      description: v.union(v.string(), v.null()),
      whatsappNumber: v.string(),
      city: v.string(),
      country: v.string(),
      logoUrl: v.union(v.string(), v.null()),
      createdAt: v.number(),
      owner: v.object({ _id: v.id("users"), email: v.string() }),
      productCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const shopId = ctx.db.normalizeId("shops", args.shopId);
    const shop = shopId ? await ctx.db.get("shops", shopId) : null;
    if (!shop) return null;
    const products = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
      .take(LIMITS.maxProducts);
    return {
      _id: shop._id,
      name: shop.name,
      slug: shop.slug,
      status: shop.status ?? "active",
      currency: shop.currency,
      language: shop.language,
      categories: shop.categories,
      description: shop.description ?? null,
      whatsappNumber: shop.whatsappNumber,
      city: shop.city,
      country: shop.country,
      logoUrl: await urlOf(ctx, shop.logoId),
      createdAt: shop._creationTime,
      owner: { _id: shop.ownerId, email: await ownerEmail(ctx, shop.ownerId) },
      productCount: products.length,
    };
  },
});

/** A shop's products, newest first, including hidden ones. */
export const products = adminQuery({
  permission: "shops.view",
  args: { shopId: v.id("shops"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      _id: v.id("products"),
      name: v.string(),
      price: v.number(),
      category: categoryValidator,
      soldOut: v.boolean(),
      hidden: v.boolean(),
      coverUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { shopId, paginationOpts }) => {
    const result = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (p) => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        category: p.category,
        soldOut: p.soldOut,
        hidden: p.hidden ?? false,
        coverUrl: await urlOf(ctx, p.imageIds[0]),
      })),
    );
    return { ...result, page };
  },
});
