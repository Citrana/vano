import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { hasFeature } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { urlOf } from "./lib/images";
import { LIST_MAX } from "./lib/salesRecords/rules";
import {
  buildReport,
  isMonth,
  monthOf,
  monthRange,
  previousMonth,
  REPORT_MAX,
  summarize,
  summaryChanges,
} from "./lib/salesRecords/report";
import { requireOwnShop, sellerQuery } from "./lib/seller";
import { shopTimeZone } from "./lib/timeZone";

/**
 * Monthly sales reports (CLAUDE.md "Sales tracking"): Business only
 * (`salesReports`), from the confirmed sales' snapshots of one month in
 * the shop's time zone, compared with the month before. Not to be
 * confused with `stats.ts` (views and WhatsApp taps).
 */

/** A month of the shop's sales (both statuses; the rules count only confirmed ones). */
async function monthRecords(ctx: QueryCtx, shopId: Id<"shops">, month: string): Promise<Doc<"salesRecords">[]> {
  const { from, to } = monthRange(month);
  return await ctx.db
    .query("salesRecords")
    .withIndex("by_shopId_and_day", (q) => q.eq("shopId", shopId).gte("day", from).lte("day", to))
    .take(REPORT_MAX + 1);
}

export const month = sellerQuery({
  permission: "ownReports.view",
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    if (!(await hasFeature(ctx, shop, "salesReports"))) {
      const kept = await ctx.db
        .query("salesRecords")
        .withIndex("by_shopId_and_soldAt", (q) => q.eq("shopId", shop._id))
        .take(LIST_MAX);
      return { locked: true as const, kept: kept.length };
    }
    if (!isMonth(args.month)) fail("REPORT_INVALID");

    const current = await monthRecords(ctx, shop._id, args.month);
    const before = await monthRecords(ctx, shop._id, previousMonth(args.month));
    const report = buildReport(current.slice(0, REPORT_MAX), args.month);
    const previous = summarize(before.slice(0, REPORT_MAX).filter((r) => r.status === "recorded"));

    // WhatsApp taps of the month's dates (stats days are UTC days).
    const { from, to } = monthRange(args.month);
    const stats = await ctx.db
      .query("shopDailyStats")
      .withIndex("by_shopId_and_day", (q) => q.eq("shopId", shop._id).gte("day", from).lte("day", to))
      .take(31);
    const taps = stats.reduce((sum, row) => sum + row.whatsappClicks, 0);

    const first = await ctx.db
      .query("salesRecords")
      .withIndex("by_shopId_and_day", (q) => q.eq("shopId", shop._id))
      .first();

    const photos = new Map<string, string | null>();
    for (const p of [...report.topByRevenue, ...report.topByPieces]) {
      if (p.photoId && !photos.has(p.photoId)) photos.set(p.photoId, await urlOf(ctx, p.photoId as Id<"_storage">));
    }
    const withPhoto = (p: (typeof report.topByRevenue)[number]) => ({ ...p, photoUrl: p.photoId ? (photos.get(p.photoId) ?? null) : null });

    return {
      locked: false as const,
      month: args.month,
      shopName: shop.name,
      slug: shop.slug,
      currency: shop.currency,
      timeZone: shopTimeZone(shop),
      firstMonth: first ? monthOf(first.day) : null,
      truncated: current.length > REPORT_MAX,
      summary: report.summary,
      previous,
      changes: summaryChanges(report.summary, previous),
      topByRevenue: report.topByRevenue.map(withPhoto),
      topByPieces: report.topByPieces.map(withPhoto),
      byDay: report.byDay,
      bySource: report.bySource,
      byCategory: report.byCategory,
      taps,
    };
  },
});
