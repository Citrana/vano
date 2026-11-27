import { filter } from "convex-helpers/server/filter";
import { paginationOptsValidator, paginationResultValidator, type PaginationResult } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery } from "../lib/access";
import { sortOrderValidator, type SortOrder } from "../lib/listOrder";
import { logAdminAction } from "../lib/audit";
import { fail } from "../lib/errors";
import { deleteShopLook } from "../lib/looks/store";
import { onProductDeleted, onShopDayStatsDeleted, onShopDeleted } from "../lib/platformStats";
import { deleteFilesNotIn } from "../lib/seller";
import { deleteSale } from "../lib/sales/store";
import { categoryValidator, languageValidator, LIMITS, type Category } from "../lib/catalog";
import { urlOf } from "../lib/images";
import { currencyValidator, type Currency } from "../lib/money";
import { shopStatusValidator } from "../lib/permissions";
import { subscriptionDoc } from "../lib/subscriptions";

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
    order?: SortOrder;
  },
): Promise<PaginationResult<Doc<"shops">>> {
  const { paginationOpts, status, currency, category, order = "desc" } = args;
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
        .order(order);
    }
    if (currency) {
      return ctx.db
        .query("shops")
        .withIndex("by_currency", (q) => q.eq("currency", currency))
        .order(order);
    }
    return ctx.db.query("shops").order(order);
  })();
  // Categories are an array (not indexable): filtered while paginating, so
  // a page can come back shorter than asked.
  const query = category ? filter(base, (shop) => shop.categories.includes(category)) : base;
  return query.paginate(paginationOpts);
}

async function ownerEmail(ctx: QueryCtx, ownerId: Id<"users">): Promise<string> {
  return (await ctx.db.get("users", ownerId))?.email ?? "";
}

/** Shops, newest first (`order: "asc"` = oldest first; by relevance when searching the name). */
export const list = adminQuery({
  permission: "shops.view",
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(shopStatusValidator),
    currency: v.optional(currencyValidator),
    category: v.optional(categoryValidator),
    order: v.optional(sortOrderValidator),
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

/**
 * Suspends or reactivates a shop. Suspended: the seller can't change
 * anything (SHOP_SUSPENDED) and visitors see "temporarily unavailable".
 * No-op if nothing changes.
 */
export const setStatus = adminMutation({
  permission: "shops.suspend",
  args: { shopId: v.id("shops"), status: shopStatusValidator },
  returns: v.null(),
  handler: async (ctx, { shopId, status }) => {
    const shop = await ctx.db.get("shops", shopId);
    if (!shop) fail("NOT_FOUND");
    if ((shop.status ?? "active") === status) return null;
    await ctx.db.patch("shops", shopId, { status });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: status === "suspended" ? "shop.suspend" : "shop.reactivate",
      targetType: "shop",
      targetId: shopId,
      targetLabel: `${shop.name} (/${shop.slug})`,
    });
    return null;
  },
});

/**
 * Deletes a shop. The shop, its logo and its counter go now (its link is
 * a 404 at once, the owner can open a new shop); products, their photos
 * and the stats rows are purged in small background batches, because a
 * shop can have up to 200 products x 6 photos. The owner account is kept.
 */
export const remove = adminMutation({
  permission: "shops.delete",
  args: { shopId: v.id("shops") },
  returns: v.null(),
  handler: async (ctx, { shopId }) => {
    const shop = await ctx.db.get("shops", shopId);
    if (!shop) fail("NOT_FOUND");
    const products = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
      .take(LIMITS.maxProducts);
    await deleteFilesNotIn(ctx, shop.logoId ? [shop.logoId] : [], []);
    await deleteShopLook(ctx, shopId);
    await onShopDeleted(ctx, shop);
    // The subscription goes with the shop; payments are kept as financial
    // history (they carry a snapshot of the shop name).
    const subscription = await subscriptionDoc(ctx, shopId);
    if (subscription) await ctx.db.delete("subscriptions", subscription._id);
    await ctx.db.delete("shops", shopId);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "shop.delete",
      targetType: "shop",
      targetId: shopId,
      targetLabel: `${shop.name} (/${shop.slug})`,
      details: { owner: await ownerEmail(ctx, shop.ownerId), products: products.length },
    });
    await ctx.scheduler.runAfter(0, internal.admin.shops.purgeShop, { shopId });
    return null;
  },
});

const PRODUCTS_PER_BATCH = 25;
const STATS_PER_BATCH = 200;
const SALES_PER_BATCH = 5;

/**
 * Background clean-up after `remove`: products (photos, upload rows,
 * counter), then recorded sales (and the photos they kept), product
 * history, then sales (and their stats), then product stats, then shop
 * stats (and the clicks counter).
 * One small batch per run; reschedules itself until nothing is left.
 */
export const purgeShop = internalMutation({
  args: { shopId: v.id("shops") },
  returns: v.null(),
  handler: async (ctx, { shopId }) => {
    const again = () => ctx.scheduler.runAfter(0, internal.admin.shops.purgeShop, { shopId });

    const products = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
      .take(PRODUCTS_PER_BATCH);
    if (products.length > 0) {
      for (const product of products) {
        await deleteFilesNotIn(ctx, product.imageIds, []);
        await onProductDeleted(ctx, product);
        await ctx.db.delete("products", product._id);
      }
      await again();
      return null;
    }

    // Recorded sales go after the products, so the photos they kept
    // (`deleteFilesNotIn` skips a photo a sale uses) are freed with them.
    const records = await ctx.db
      .query("salesRecords")
      .withIndex("by_shopId_and_soldAt", (q) => q.eq("shopId", shopId))
      .take(STATS_PER_BATCH);
    if (records.length > 0) {
      for (const record of records) {
        await ctx.db.delete("salesRecords", record._id);
        if (record.photoId) await deleteFilesNotIn(ctx, [record.photoId], []);
      }
      await again();
      return null;
    }

    const events = await ctx.db
      .query("productEvents")
      .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
      .take(STATS_PER_BATCH);
    if (events.length > 0) {
      for (const event of events) await ctx.db.delete("productEvents", event._id);
      await again();
      return null;
    }

    const sales = await ctx.db
      .query("sales")
      .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
      .take(SALES_PER_BATCH);
    if (sales.length > 0) {
      for (const sale of sales) await deleteSale(ctx, sale);
      await again();
      return null;
    }

    const productStats = await ctx.db
      .query("productDailyStats")
      .withIndex("by_shopId_and_day", (q) => q.eq("shopId", shopId))
      .take(STATS_PER_BATCH);
    if (productStats.length > 0) {
      for (const row of productStats) await ctx.db.delete("productDailyStats", row._id);
      await again();
      return null;
    }

    // Team accounts (CLAUDE.md "Team accounts"): members, invites, activity.
    const members = await ctx.db
      .query("shopMembers")
      .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
      .take(STATS_PER_BATCH);
    if (members.length > 0) {
      for (const row of members) {
        const user = await ctx.db.get("users", row.userId);
        if (user?.activeShopId === shopId) await ctx.db.patch("users", user._id, { activeShopId: undefined });
        await ctx.db.delete("shopMembers", row._id);
      }
      await again();
      return null;
    }
    for (const status of ["pending", "accepted", "revoked"] as const) {
      const invites = await ctx.db
        .query("shopInvites")
        .withIndex("by_shopId_and_status", (q) => q.eq("shopId", shopId).eq("status", status))
        .take(STATS_PER_BATCH);
      if (invites.length > 0) {
        for (const row of invites) await ctx.db.delete("shopInvites", row._id);
        await again();
        return null;
      }
    }
    const activity = await ctx.db
      .query("shopActivity")
      .withIndex("by_shopId_and_at", (q) => q.eq("shopId", shopId))
      .take(STATS_PER_BATCH);
    if (activity.length > 0) {
      for (const row of activity) await ctx.db.delete("shopActivity", row._id);
      await again();
      return null;
    }

    // Lower plans the seller chose (docs/payments.md section 15).
    for (const status of ["scheduled", "kept", "replaced"] as const) {
      const changes = await ctx.db
        .query("planChanges")
        .withIndex("by_shopId_and_status", (q) => q.eq("shopId", shopId).eq("status", status))
        .take(STATS_PER_BATCH);
      if (changes.length > 0) {
        for (const row of changes) await ctx.db.delete("planChanges", row._id);
        await again();
        return null;
      }
    }

    // Trial reminder email records (CLAUDE.md "Emails").
    const trialEmails = await ctx.db
      .query("trialEmails")
      .withIndex("by_shopId_and_kind_and_trialEnd", (q) => q.eq("shopId", shopId))
      .take(STATS_PER_BATCH);
    if (trialEmails.length > 0) {
      for (const row of trialEmails) await ctx.db.delete("trialEmails", row._id);
      await again();
      return null;
    }

    const shopStats = await ctx.db
      .query("shopDailyStats")
      .withIndex("by_shopId_and_day", (q) => q.eq("shopId", shopId))
      .take(STATS_PER_BATCH);
    if (shopStats.length > 0) {
      for (const row of shopStats) {
        await onShopDayStatsDeleted(ctx, row);
        await ctx.db.delete("shopDailyStats", row._id);
      }
      await again();
    }
    return null;
  },
});
