import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getEntitlements, hasFeature, shopProducts, visibleProductIds } from "./lib/entitlements";
import { urlOf, urlsOf } from "./lib/images";
import { publicLookFor } from "./lib/looks/store";
import { readSettings } from "./lib/settings";
import { bestSaleFor, publicSale } from "./lib/sales/active";
import { liveSalesFor, saleForProduct } from "./lib/sales/store";
import { codeFieldFor, evaluateCode, isWrongAttempt } from "./lib/discountCodes/active";
import { codeTextProblem, normalizeCode } from "./lib/discountCodes/code";
import { cleanVisitorId } from "./lib/discountCodes/rules";
import { codeByText, liveCodesFor, visibleProduct } from "./lib/discountCodes/store";
import { codeResultValidator, type CodeResult } from "./lib/discountCodes/validators";
import { rateLimiter } from "./lib/rateLimits";

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
    /** About and contact (shown when the look's About switch is on, only the filled parts). */
    openingHours: shop.openingHours ?? null,
    deliveryAreas: shop.deliveryAreas ?? null,
    socials: {
      instagram: shop.socials?.instagram ?? null,
      tiktok: shop.socials?.tiktok ?? null,
      facebook: shop.socials?.facebook ?? null,
    },
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
    const sales = await liveSalesFor(ctx, shop);
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
          /** Section and label flags (CLAUDE.md "Shop looks"). */
          featured: p.featured === true,
          fewLeft: p.fewLeft === true && !p.soldOut,
          backInStock: p.backInStock === true && !p.soldOut,
          /** Every colour and size: the shop's filters need them; the card shows CARD_TAGS_MAX (the description is on the product page). */
          colors: p.colors,
          sizes: p.sizes,
          /** When it was added (the page shows "New" for NEW_BADGE_DAYS). */
          createdAt: p._creationTime,
          coverUrl: await urlOf(ctx, p.imageIds[0]),
          sale: publicSale(bestSaleFor(p, sales, shop.currency)),
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
        fewLeft: product.fewLeft === true && !product.soldOut,
        sale: publicSale(bestSaleFor(product, await liveSalesFor(ctx, shop), shop.currency)),
        /** Show "Have a discount code?" (a live code applies). Never the codes themselves. */
        codeField: codeFieldFor(product, await liveCodesFor(ctx, shop), shop.currency),
        imageUrls: await urlsOf(ctx, product.imageIds.slice(0, limits.photosPerProduct)),
      },
    };
  },
});

/**
 * A product's price right now, for the order button (CLAUDE.md "Sales"):
 * live, so the WhatsApp message uses the price at the moment the
 * customer taps, even on a page opened before a sale started or ended.
 * Null for an unknown, hidden or suspended product. `codeField` says
 * whether the discount code field shows (it disappears live when the
 * last code ends or the plan no longer includes codes).
 */
export const productPrice = query({
  args: { productId: v.string() },
  handler: async (ctx, { productId }) => {
    const id = ctx.db.normalizeId("products", productId);
    const product = id ? await ctx.db.get("products", id) : null;
    if (!product || product.hidden) return null;
    const shop = await ctx.db.get("shops", product.shopId);
    if (!shop || isSuspended(shop)) return null;
    return {
      price: product.price,
      sale: publicSale(bestSaleFor(product, await liveSalesFor(ctx, shop), shop.currency)),
      codeField: codeFieldFor(product, await liveCodesFor(ctx, shop), shop.currency),
    };
  },
});

/**
 * Live prices for every visible product of a shop, for the WhatsApp
 * buttons on the product cards (CLAUDE.md "Sales"): one subscription for
 * the whole page, so a card's message carries the price at tap time.
 * Null for an unknown or suspended shop. Prices only — nothing else.
 */
export const shopPrices = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const shop = await shopFromSlug(ctx, slug);
    if (!shop || isSuspended(shop)) return null;
    const products = await shopProducts(ctx, shop._id);
    const { limits } = await getEntitlements(ctx, shop);
    const visible = visibleProductIds(products, limits);
    const sales = await liveSalesFor(ctx, shop);
    return products
      .filter((p) => visible.has(p._id))
      .map((p) => ({ _id: p._id, price: p.price, sale: publicSale(bestSaleFor(p, sales, shop.currency)) }));
  },
});

const codeArgs = { productId: v.string(), code: v.string(), visitorId: v.string() };

/**
 * Tries a discount code on a product (CLAUDE.md "Discount codes"), with
 * the guessing limits: a visitor or shop out of wrong attempts gets
 * `tooMany` before the code is even read, and every wrong attempt costs
 * one from both buckets. Results are returned, never thrown, so the
 * count isn't rolled back. The price is computed here, never trusted from
 * the browser, and the best of the code and a running sale wins.
 */
async function tryCode(
  ctx: MutationCtx,
  args: { productId: string; code: string; visitorId: string },
  redeem: boolean,
): Promise<CodeResult> {
  const found = await visibleProduct(ctx, args.productId);
  if (!found) return { status: "invalid" };
  const { shop, product } = found;
  const visitorId = cleanVisitorId(args.visitorId);
  const visitorKey = `${shop._id}:${visitorId}`;
  const visitorLimit = await rateLimiter.check(ctx, "discountCodeVisitor", { key: visitorKey });
  const shopLimit = await rateLimiter.check(ctx, "discountCodeShop", { key: shop._id });
  if (!visitorLimit.ok || !shopLimit.ok) return { status: "tooMany" };

  const text = normalizeCode(args.code);
  const entitled = codeTextProblem(text) === null && (await hasFeature(ctx, shop, "discountCodes"));
  const code = entitled ? await codeByText(ctx, shop._id, text) : null;
  const used =
    code && redeem
      ? await ctx.db
          .query("discountCodeUses")
          .withIndex("by_codeId_and_visitorId_and_productId", (q) =>
            q.eq("codeId", code._id).eq("visitorId", visitorId).eq("productId", product._id),
          )
          .unique()
      : null;
  const now = Date.now();
  const sale = await saleForProduct(ctx, shop, product);
  const result = evaluateCode({ code, product, sale, currency: shop.currency, now, alreadyUsed: used !== null });

  if (isWrongAttempt(result)) {
    await rateLimiter.limit(ctx, "discountCodeVisitor", { key: visitorKey });
    await rateLimiter.limit(ctx, "discountCodeShop", { key: shop._id });
  }
  if (redeem && code && result.status === "applied" && used === null) {
    await ctx.db.insert("discountCodeUses", {
      codeId: code._id,
      shopId: shop._id,
      productId: product._id,
      visitorId,
      at: now,
    });
    const uses = code.uses + 1;
    const usedUp = code.maxUses !== undefined && uses >= code.maxUses;
    await ctx.db.patch("discountCodes", code._id, { uses, ...(usedUp ? { live: false } : {}) });
  }
  return result;
}

/** "Apply": checks a code on a product and returns the price with it. Counts nothing. */
export const checkDiscountCode = mutation({
  args: codeArgs,
  returns: codeResultValidator,
  handler: async (ctx, args) => await tryCode(ctx, args, false),
});

/**
 * The customer taps Order with a code: checked again at that moment, the
 * maximum enforced in this transaction and one use counted (once per
 * visitor and product). The result is the price for the WhatsApp message.
 */
export const redeemDiscountCode = mutation({
  args: codeArgs,
  returns: codeResultValidator,
  handler: async (ctx, args) => await tryCode(ctx, args, true),
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
