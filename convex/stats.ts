import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { hasFeature, hiddenFromShop } from "./lib/entitlements";
import { addDays, isDay, utcDay } from "./lib/days";
import { LIMITS } from "./lib/catalog";
import { onShopDayStatsWritten } from "./lib/platformStats";
import { shopCodes } from "./lib/discountCodes/store";
import { requireOwnShop, sellerQuery } from "./lib/seller";
import { bumpSaleStats, saleForProduct } from "./lib/sales/store";

/**
 * Anonymous view / WhatsApp-click counters (CLAUDE.md "Stats"): daily rows,
 * no personal data. The record mutations take plain strings and quietly
 * return false for unknown ids — or a suspended / deleted shop — so a
 * stale page never shows an error.
 */

type ShopCounter = "shopViews" | "productViews" | "whatsappClicks";
type ProductCounter = "views" | "whatsappClicks";

async function bumpShop(ctx: MutationCtx, shopId: Id<"shops">, day: string, field: ShopCounter) {
  const row = await ctx.db
    .query("shopDailyStats")
    .withIndex("by_shopId_and_day", (q) => q.eq("shopId", shopId).eq("day", day))
    .unique();
  if (row) {
    await ctx.db.patch("shopDailyStats", row._id, { [field]: row[field] + 1 });
    await onShopDayStatsWritten(ctx, row, (await ctx.db.get("shopDailyStats", row._id))!);
  } else {
    const id = await ctx.db.insert("shopDailyStats", {
      shopId,
      day,
      shopViews: 0,
      productViews: 0,
      whatsappClicks: 0,
      [field]: 1,
    });
    await onShopDayStatsWritten(ctx, null, (await ctx.db.get("shopDailyStats", id))!);
  }
}

async function bumpProduct(
  ctx: MutationCtx,
  shopId: Id<"shops">,
  productId: Id<"products">,
  day: string,
  field: ProductCounter,
) {
  const row = await ctx.db
    .query("productDailyStats")
    .withIndex("by_productId_and_day", (q) => q.eq("productId", productId).eq("day", day))
    .unique();
  if (row) {
    await ctx.db.patch("productDailyStats", row._id, { [field]: row[field] + 1 });
  } else {
    await ctx.db.insert("productDailyStats", {
      shopId,
      productId,
      day,
      views: 0,
      whatsappClicks: 0,
      [field]: 1,
    });
  }
}

export const recordShopView = mutation({
  args: { shopId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const shopId = ctx.db.normalizeId("shops", args.shopId);
    const shop = shopId ? await ctx.db.get("shops", shopId) : null;
    if (!shopId || !shop || shop.status === "suspended") return false;
    await bumpShop(ctx, shopId, utcDay(Date.now()), "shopViews");
    return true;
  },
});

async function recordForProduct(
  ctx: MutationCtx,
  rawId: string,
  shopField: ShopCounter,
  productField: ProductCounter,
): Promise<boolean> {
  const productId = ctx.db.normalizeId("products", rawId);
  const product = productId ? await ctx.db.get("products", productId) : null;
  if (!product || hiddenFromShop(product)) return false;
  // A sold-out product can't be ordered: its WhatsApp click isn't counted.
  if (productField === "whatsappClicks" && product.soldOut) return false;
  // A suspended shop, or a deleted one whose products are being purged.
  const shop = await ctx.db.get("shops", product.shopId);
  if (!shop || shop.status === "suspended") return false;
  const day = utcDay(Date.now());
  await bumpShop(ctx, product.shopId, day, shopField);
  await bumpProduct(ctx, product.shopId, product._id, day, productField);
  // Per-sale numbers (CLAUDE.md "Sales"): the sale the visitor got.
  const sale = await saleForProduct(ctx, shop, product);
  if (sale) await bumpSaleStats(ctx, sale.saleId as Id<"sales">, product.shopId, day, productField);
  return true;
}

export const recordProductView = mutation({
  args: { productId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { productId }) =>
    await recordForProduct(ctx, productId, "productViews", "views"),
});

export const recordWhatsappClick = mutation({
  args: { productId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { productId }) =>
    await recordForProduct(ctx, productId, "whatsappClicks", "whatsappClicks"),
});

const totals = v.object({
  shopViews: v.number(),
  productViews: v.number(),
  whatsappClicks: v.number(),
});

/**
 * Dashboard numbers for the caller's shop: today / last 7 / last 30 days,
 * plus per-product totals over 30 days. `today` ("YYYY-MM-DD", UTC) comes
 * from the client because queries must not read the clock.
 *
 * Shop stats are a plan feature (`shopStats`): on a plan without it the
 * result is `{ locked: true }` and the dashboard shows an upgrade card.
 * Views and clicks are still recorded, so the history is there after an
 * upgrade.
 */
export const summary = sellerQuery({
  permission: "ownStats.view",
  args: { today: v.string() },
  returns: v.union(
    v.object({ locked: v.literal(true) }),
    v.object({
      locked: v.literal(false),
      today: totals,
      last7: totals,
      last30: totals,
      products: v.array(
        v.object({ productId: v.id("products"), views: v.number(), whatsappClicks: v.number() }),
      ),
      /** Uses per discount code, most used first (CLAUDE.md "Discount codes"). */
      discountCodes: v.array(
        v.object({ codeId: v.id("discountCodes"), code: v.string(), uses: v.number(), maxUses: v.union(v.number(), v.null()) }),
      ),
    }),
  ),
  handler: async (ctx, { today }) => {
    const shop = await requireOwnShop(ctx);
    if (!(await hasFeature(ctx, shop, "shopStats"))) return { locked: true as const };
    const end = isDay(today) ? today : "9999-12-31";
    const from30 = isDay(today) ? addDays(today, -29) : "0000-01-01";
    const from7 = isDay(today) ? addDays(today, -6) : "0000-01-01";

    const days = await ctx.db
      .query("shopDailyStats")
      .withIndex("by_shopId_and_day", (q) =>
        q.eq("shopId", shop._id).gte("day", from30).lte("day", end),
      )
      .take(31);
    const zero = () => ({ shopViews: 0, productViews: 0, whatsappClicks: 0 });
    const sum = { today: zero(), last7: zero(), last30: zero() };
    for (const row of days) {
      const buckets = [sum.last30];
      if (row.day >= from7) buckets.push(sum.last7);
      if (row.day === end) buckets.push(sum.today);
      for (const b of buckets) {
        b.shopViews += row.shopViews;
        b.productViews += row.productViews;
        b.whatsappClicks += row.whatsappClicks;
      }
    }

    const productRows = await ctx.db
      .query("productDailyStats")
      .withIndex("by_shopId_and_day", (q) =>
        q.eq("shopId", shop._id).gte("day", from30).lte("day", end),
      )
      .take(LIMITS.maxProducts * 31);
    const perProduct = new Map<Id<"products">, { views: number; whatsappClicks: number }>();
    for (const row of productRows) {
      const acc = perProduct.get(row.productId) ?? { views: 0, whatsappClicks: 0 };
      acc.views += row.views;
      acc.whatsappClicks += row.whatsappClicks;
      perProduct.set(row.productId, acc);
    }
    return {
      locked: false as const,
      ...sum,
      products: [...perProduct].map(([productId, acc]) => ({ productId, ...acc })),
      discountCodes: (await shopCodes(ctx, shop._id))
        .map((c) => ({ codeId: c._id, code: c.code, uses: c.uses, maxUses: c.maxUses ?? null }))
        .sort((a, b) => b.uses - a.uses || a.code.localeCompare(b.code)),
    };
  },
});
