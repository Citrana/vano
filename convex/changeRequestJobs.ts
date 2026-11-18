import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const BATCH = 200;

/**
 * Daily (crons.ts): deletes expired link redirects, which frees the old
 * link for anyone, and expired verification codes. Runs in batches and
 * reschedules itself until nothing is left.
 */
export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const redirects = await ctx.db
      .query("slugRedirects")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(BATCH);
    for (const row of redirects) await ctx.db.delete("slugRedirects", row._id);
    // Codes are kept a day after expiry so a late request still gets a clear error.
    const codes = await ctx.db
      .query("phoneVerifications")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now - 86_400_000))
      .take(BATCH);
    for (const row of codes) await ctx.db.delete("phoneVerifications", row._id);
    if (redirects.length === BATCH || codes.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.changeRequestJobs.cleanup, {});
    }
    return null;
  },
});
