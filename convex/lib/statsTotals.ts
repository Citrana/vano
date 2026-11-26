import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { TRIAL_MONTHS_MAX } from "./planFeatures";

/**
 * Shop view / WhatsApp click totals from the daily rows (CLAUDE.md "Stats").
 * Shared by the dashboard (`stats.summary`) and the trial reminder emails.
 */
export type ShopTotals = { shopViews: number; productViews: number; whatsappClicks: number };

export function zeroTotals(): ShopTotals {
  return { shopViews: 0, productViews: 0, whatsappClicks: 0 };
}

export function addDayStats(into: ShopTotals, row: Pick<Doc<"shopDailyStats">, keyof ShopTotals>): void {
  into.shopViews += row.shopViews;
  into.productViews += row.productViews;
  into.whatsappClicks += row.whatsappClicks;
}

/** Enough days for the longest trial. */
const MAX_DAYS = TRIAL_MONTHS_MAX * 31 + 1;

/** Totals over the UTC days `from`..`to` (inclusive, "YYYY-MM-DD"), at most `MAX_DAYS` rows. */
export async function shopStatsTotals(
  ctx: QueryCtx,
  shopId: Id<"shops">,
  from: string,
  to: string,
): Promise<ShopTotals> {
  const rows = await ctx.db
    .query("shopDailyStats")
    .withIndex("by_shopId_and_day", (q) => q.eq("shopId", shopId).gte("day", from).lte("day", to))
    .take(MAX_DAYS);
  const sum = zeroTotals();
  for (const row of rows) addDayStats(sum, row);
  return sum;
}
