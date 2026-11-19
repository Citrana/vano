import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { lookRow } from "./lib/looks/store";
import { promoLiveAt } from "./lib/looks/schedule";

/**
 * Scheduled by `shopLooks.publish` at an event & promo banner's start and
 * end (CLAUDE.md "Shop looks"). Recomputes `promoLive` from the CURRENT
 * published promo, so a job left over from an older publish is harmless.
 */
export const syncPromo = internalMutation({
  args: { shopId: v.id("shops") },
  returns: v.null(),
  handler: async (ctx, { shopId }) => {
    const row = await lookRow(ctx, shopId);
    if (!row) return null;
    const live = promoLiveAt(row.published?.overrides.promo, Date.now());
    if ((row.promoLive === true) !== live) await ctx.db.patch("shopLooks", row._id, { promoLive: live });
    return null;
  },
});
