import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { liveFlags } from "./lib/looks/schedule";
import { lookRow } from "./lib/looks/store";

/**
 * Scheduled by `shopLooks.publish` at an event & promo banner's and a
 * profile decoration's start and end (CLAUDE.md "Shop looks").
 * Recomputes `promoLive` and `decorationLive` from the CURRENT published
 * look, so a job left over from an older publish is harmless.
 */
async function sync(ctx: MutationCtx, shopId: Id<"shops">): Promise<null> {
  const row = await lookRow(ctx, shopId);
  if (!row) return null;
  const { promoLive, decorationLive } = liveFlags(row.published, Date.now());
  if ((row.promoLive === true) !== promoLive || (row.decorationLive === true) !== decorationLive) {
    await ctx.db.patch("shopLooks", row._id, { promoLive, decorationLive });
  }
  return null;
}

export const syncSchedules = internalMutation({
  args: { shopId: v.id("shops") },
  returns: v.null(),
  handler: async (ctx, { shopId }) => await sync(ctx, shopId),
});

/** Older name, kept so jobs scheduled before `syncSchedules` existed still run. */
export const syncPromo = internalMutation({
  args: { shopId: v.id("shops") },
  returns: v.null(),
  handler: async (ctx, { shopId }) => await sync(ctx, shopId),
});
