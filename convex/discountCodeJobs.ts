import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { codeLiveAt } from "./lib/discountCodes/active";

/**
 * Discount code jobs (CLAUDE.md "Discount codes"). `sync` is scheduled by
 * every write (`writeCodeLiveAndSchedule`) at the code's start and end and
 * recomputes the stored `live` flag from the CURRENT row, so the product
 * page field appears and disappears on time; an old job is harmless.
 */
export const sync = internalMutation({
  args: { codeId: v.id("discountCodes") },
  returns: v.null(),
  handler: async (ctx, { codeId }) => {
    const code = await ctx.db.get("discountCodes", codeId);
    if (!code) return null;
    const live = codeLiveAt(code, Date.now());
    if (live !== code.live) await ctx.db.patch("discountCodes", codeId, { live });
    return null;
  },
});

/** Hourly safety net (crons.ts): a code still live after its end is switched off. */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const stale = await ctx.db
      .query("discountCodes")
      .withIndex("by_live_and_endsAt", (q) => q.eq("live", true).lte("endsAt", Date.now()))
      .take(200);
    for (const code of stale) await ctx.db.patch("discountCodes", code._id, { live: false });
    return null;
  },
});

const PURGE_BATCH = 200;

/** Deletes a deleted code's use rows, a batch at a time. */
export const purgeUses = internalMutation({
  args: { codeId: v.id("discountCodes") },
  returns: v.null(),
  handler: async (ctx, { codeId }) => {
    const rows = await ctx.db
      .query("discountCodeUses")
      .withIndex("by_codeId_and_visitorId_and_productId", (q) => q.eq("codeId", codeId))
      .take(PURGE_BATCH);
    for (const row of rows) await ctx.db.delete("discountCodeUses", row._id);
    if (rows.length === PURGE_BATCH) await ctx.scheduler.runAfter(0, internal.discountCodeJobs.purgeUses, { codeId });
    return null;
  },
});
