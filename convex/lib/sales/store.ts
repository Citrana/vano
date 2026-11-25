import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { getEntitlements, hasFeature, shopProducts, visibleProductIds } from "../entitlements";
import { promoSaleSummary, type PromoSaleSummary } from "../looks/announcement";
import { bestSaleFor, publicSale, saleLiveAt, type AppliedSale } from "./active";
import { ENDING_SOON_MS, SALES_MAX } from "./rules";

/**
 * Database side of sales (CLAUDE.md "Sales"): reading a shop's sales,
 * the stored `live` flag and its scheduled jobs, stats rows and clean-up.
 * Callers check permission / ownership.
 */

export async function shopSales(ctx: QueryCtx, shopId: Id<"shops">): Promise<Doc<"sales">[]> {
  return await ctx.db
    .query("sales")
    .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
    .order("desc")
    .take(SALES_MAX);
}

/**
 * The sales visitors get right now: live ones, and only while the plan
 * includes `salesPromotions` (after a downgrade they stop showing and the
 * normal prices return; the sales stay saved).
 */
export async function liveSalesFor(ctx: QueryCtx, shop: Doc<"shops">): Promise<Doc<"sales">[]> {
  const live = await ctx.db
    .query("sales")
    .withIndex("by_shopId_and_live", (q) => q.eq("shopId", shop._id).eq("live", true))
    .take(SALES_MAX);
  if (live.length === 0) return [];
  return (await hasFeature(ctx, shop, "salesPromotions")) ? live : [];
}

/**
 * What the Promo bar says about the running sale (biggest discount,
 * soonest countdown end), over the products visitors see, or null.
 * The same pieces as `public.shopBySlug`.
 */
export async function liveSaleSummary(ctx: QueryCtx, shop: Doc<"shops">): Promise<PromoSaleSummary | null> {
  const sales = await liveSalesFor(ctx, shop);
  if (sales.length === 0) return null;
  const products = await shopProducts(ctx, shop._id);
  const visible = visibleProductIds(products, (await getEntitlements(ctx, shop)).limits);
  return promoSaleSummary(
    products.filter((p) => visible.has(p._id)).map((p) => ({ sale: publicSale(bestSaleFor(p, sales, shop.currency)) })),
  );
}

/** The sale a visitor gets on one product right now, or null. */
export async function saleForProduct(
  ctx: QueryCtx,
  shop: Doc<"shops">,
  product: Doc<"products">,
): Promise<AppliedSale | null> {
  return bestSaleFor(product, await liveSalesFor(ctx, shop), shop.currency);
}

/**
 * The shop's products as the sale and discount code editors show them
 * (picker, preview, overview): visible to customers, with a cover photo.
 */
export async function pickerProducts(ctx: QueryCtx, shopId: Id<"shops">) {
  const out = [];
  for (const p of await shopProducts(ctx, shopId)) {
    if (p.hidden) continue;
    out.push({
      _id: p._id,
      name: p.name,
      price: p.price,
      category: p.category,
      soldOut: p.soldOut,
      coverUrl: p.imageIds[0] ? await ctx.storage.getUrl(p.imageIds[0]) : null,
    });
  }
  return out;
}

export type SaleJobKind = "start" | "endingSoon" | "end";

/**
 * Stores the `live` flag for `now` and schedules `saleJobs.sync` at the
 * sale's future start, end and "ending soon" times. A job left over from
 * an older version of the sale recomputes from the current row and does
 * nothing else (its `at` no longer matches).
 */
export async function writeLiveAndSchedule(ctx: MutationCtx, sale: Doc<"sales">, now: number): Promise<void> {
  const live = saleLiveAt(sale, now);
  if (live !== sale.live) await ctx.db.patch("sales", sale._id, { live });
  const jobs: { kind: SaleJobKind; at: number }[] = [
    { kind: "start", at: sale.startsAt },
    { kind: "endingSoon", at: sale.endsAt - ENDING_SOON_MS },
    { kind: "end", at: sale.endsAt },
  ];
  for (const job of jobs) {
    if (job.at <= now) continue;
    // No "ending soon" for a sale that hasn't started by then.
    if (job.kind === "endingSoon" && job.at <= sale.startsAt) continue;
    await ctx.scheduler.runAt(job.at, internal.saleJobs.sync, { saleId: sale._id, kind: job.kind, at: job.at });
  }
}

/** Counts a view or WhatsApp click on a sale item. */
export async function bumpSaleStats(
  ctx: MutationCtx,
  saleId: Id<"sales">,
  shopId: Id<"shops">,
  day: string,
  field: "views" | "whatsappClicks",
): Promise<void> {
  const row = await ctx.db
    .query("saleDailyStats")
    .withIndex("by_saleId_and_day", (q) => q.eq("saleId", saleId).eq("day", day))
    .unique();
  if (row) await ctx.db.patch("saleDailyStats", row._id, { [field]: row[field] + 1 });
  else await ctx.db.insert("saleDailyStats", { saleId, shopId, day, views: 0, whatsappClicks: 0, [field]: 1 });
}

/** Totals over a sale's life (at most `PROMO_MAX_DAYS` + edits). */
export async function saleTotals(
  ctx: QueryCtx,
  saleId: Id<"sales">,
): Promise<{ views: number; whatsappClicks: number }> {
  let views = 0;
  let whatsappClicks = 0;
  const rows = await ctx.db
    .query("saleDailyStats")
    .withIndex("by_saleId_and_day", (q) => q.eq("saleId", saleId))
    .take(400);
  for (const row of rows) {
    views += row.views;
    whatsappClicks += row.whatsappClicks;
  }
  return { views, whatsappClicks };
}

/** Deletes a sale and its stats rows (scheduled jobs then find nothing). */
export async function deleteSale(ctx: MutationCtx, sale: Doc<"sales">): Promise<void> {
  for await (const row of ctx.db
    .query("saleDailyStats")
    .withIndex("by_saleId_and_day", (q) => q.eq("saleId", sale._id))) {
    await ctx.db.delete("saleDailyStats", row._id);
  }
  await ctx.db.delete("sales", sale._id);
}

/**
 * A product is being deleted: drop it from its shop's sales (chosen
 * products and exclusions). A sale left with no chosen product simply
 * applies to nothing. Called by `deleteProduct`.
 */
export async function forgetProductInSales(ctx: MutationCtx, product: Doc<"products">): Promise<void> {
  for (const sale of await shopSales(ctx, product.shopId)) {
    const t = sale.target;
    const ids = t.kind === "products" ? t.productIds : t.excludedIds;
    if (!ids.includes(product._id)) continue;
    const next = ids.filter((id) => id !== product._id);
    const target = t.kind === "products" ? { ...t, productIds: next } : { ...t, excludedIds: next };
    await ctx.db.patch("sales", sale._id, { target, version: sale.version + 1 });
  }
}
