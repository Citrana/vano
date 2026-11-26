import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { canShopDo, getEntitlements } from "./lib/entitlements";
import { notify } from "./lib/notify";
import { isPaused, saleLiveAt } from "./lib/sales/active";
import { ENDING_SOON_MS } from "./lib/sales/rules";

/**
 * Scheduled by every sale write (`writeLiveAndSchedule`) at the sale's
 * start, "ending soon" time and end (CLAUDE.md "Sales"). Recomputes the
 * stored `live` flag from the CURRENT row, so prices change on time even
 * when nobody opens the app, and a job left over from an older version of
 * the sale is harmless. It notifies the seller only when `at` still
 * matches the sale's dates (dedupe keys make retries safe), and only
 * while the plan shows sales.
 */
export const sync = internalMutation({
  args: {
    saleId: v.id("sales"),
    kind: v.union(v.literal("start"), v.literal("endingSoon"), v.literal("end")),
    at: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { saleId, kind, at }) => {
    const sale = await ctx.db.get("sales", saleId);
    if (!sale) return null;
    const now = Date.now();
    const live = saleLiveAt(sale, now);
    if (live !== sale.live) await ctx.db.patch("sales", saleId, { live });

    const shop = await ctx.db.get("shops", sale.shopId);
    if (!shop || shop.status === "suspended") return null;
    const { limits } = await getEntitlements(ctx, shop, now);
    if (canShopDo(limits, { kind: "feature", feature: "salesPromotions" }) !== null) return null;

    const to = { shop };
    if (kind === "start" && sale.startsAt === at && live) {
      await notify(ctx, {
        data: { type: "sale.started", saleId, name: sale.name },
        to,
        dedupeKey: `sale.started:${saleId}:${at}`,
      });
    } else if (kind === "endingSoon" && sale.endsAt - ENDING_SOON_MS === at && live) {
      await notify(ctx, {
        data: { type: "sale.endingSoon", saleId, name: sale.name, endsAt: sale.endsAt },
        to,
        dedupeKey: `sale.endingSoon:${saleId}:${sale.endsAt}`,
      });
    } else if (kind === "end" && sale.endsAt === at && !isPaused(sale)) {
      await notify(ctx, {
        data: { type: "sale.ended", saleId, name: sale.name },
        to,
        dedupeKey: `sale.ended:${saleId}:${at}`,
      });
    }
    return null;
  },
});

/**
 * Hourly safety net (crons.ts): a sale still marked live after its end
 * (a job that failed) is switched off, so the normal price returns.
 */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("sales")
      .withIndex("by_live_and_endsAt", (q) => q.eq("live", true).lte("endsAt", now))
      .take(200);
    for (const sale of stale) await ctx.db.patch("sales", sale._id, { live: false });
    return null;
  },
});
