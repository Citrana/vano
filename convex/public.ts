import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { getEntitlements, shopProducts, visibleProductIds } from "./lib/entitlements";
import { urlOf, urlsOf } from "./lib/images";
import { publicLookFor } from "./lib/looks/store";
import { readSettings } from "./lib/settings";

/**
 * Unauthenticated reads for the public shop pages. They never return
 * `ownerId` or anything personal about the seller beyond what the seller
 * chose to publish (CLAUDE.md "Security & ownership").
 *
 * A suspended shop returns only `{ suspended: true, name, language }` so
 * the page can say "temporarily unavailable" in the shop's language —
 * no WhatsApp number, products or logo. Products hidden by an admin are
 * left out (and their page is a 404), and so are products over the shop's
 * plan limit (CLAUDE.md "Billing"); only the plan's number of photos per
 * product is shown. The shop's look is the published one only when the
 * plan includes `allLooks` (CLAUDE.md "Shop looks"), else the free look.
 */

function suspendedMarker(shop: Doc<"shops">) {
  return { suspended: true as const, name: shop.name, language: shop.language };
}

const isSuspended = (shop: Doc<"shops">) => shop.status === "suspended";

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
    /** The published look, or the free look when the plan doesn't include it. Never the draft. */
    look: await publicLookFor(ctx, shop),
  };
}

async function shopFromSlug(ctx: QueryCtx, slug: string) {
  return await ctx.db
    .query("shops")
    .withIndex("by_slug", (q) => q.eq("slug", slug.toLowerCase()))
    .unique();
}

/**
 * An old shop link that still redirects (after an approved link change):
 * the shop's current link, or null. Nothing else about the shop.
 */
export const slugRedirect = query({
  args: { slug: v.string() },
  returns: v.union(v.null(), v.object({ slug: v.string() })),
  handler: async (ctx, { slug }) => {
    const redirect = await ctx.db
      .query("slugRedirects")
      .withIndex("by_fromSlug", (q) => q.eq("fromSlug", slug.toLowerCase()))
      .unique();
    if (!redirect) return null;
    const shop = await ctx.db.get("shops", redirect.shopId);
    return shop ? { slug: shop.slug } : null;
  },
});

/** Just the shop's public fields (no products), or null. Cheap existence check. */
export const shopBasics = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const shop = await shopFromSlug(ctx, slug);
    if (!shop) return null;
    if (isSuspended(shop)) return suspendedMarker(shop);
    return { suspended: false as const, ...(await publicShop(ctx, shop)) };
  },
});

/** The shop page: shop + its products (newest first). Null for an unknown slug. */
export const shopBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const shop = await shopFromSlug(ctx, slug);
    if (!shop) return null;
    if (isSuspended(shop)) return suspendedMarker(shop);
    const products = await shopProducts(ctx, shop._id);
    const { limits } = await getEntitlements(ctx, shop);
    // Hidden by an admin or over the plan limit: never shown.
    const visible = visibleProductIds(products, limits);
    return {
      suspended: false as const,
      shop: await publicShop(ctx, shop),
      products: await Promise.all(
        products.filter((p) => visible.has(p._id)).map(async (p) => ({
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
    if (isSuspended(shop)) return suspendedMarker(shop);
    const id = ctx.db.normalizeId("products", productId);
    const product = id ? await ctx.db.get("products", id) : null;
    if (!product || product.shopId !== shop._id || product.hidden) return null;
    const { limits } = await getEntitlements(ctx, shop);
    if (!visibleProductIds(await shopProducts(ctx, shop._id), limits).has(product._id)) return null;
    return {
      suspended: false as const,
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
        imageUrls: await urlsOf(ctx, product.imageIds.slice(0, limits.photosPerProduct)),
      },
    };
  },
});

/** Whether public sign-up is open (admin settings). Only a boolean. */
export const signupOpen = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => (await readSettings(ctx)).signupEnabled,
});

/**
 * The admin announcement (e.g. planned maintenance) for the public landing
 * page, in both languages, or null when none is set. Admin-written text
 * only — nothing personal.
 */
export const platformNotice = query({
  args: {},
  returns: v.union(v.null(), v.object({ en: v.string(), fr: v.string() })),
  handler: async (ctx) => (await readSettings(ctx)).announcement,
});
