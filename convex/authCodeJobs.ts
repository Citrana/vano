import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/** Rows deleted per run; a full batch schedules the next one. */
export const CLEANUP_BATCH = 200;

/**
 * Deletes expired sign-up / reset codes (CLAUDE.md "Auth codes"). Convex
 * Auth only deletes a code when it's used, replaced or tried after its
 * end, and looks codes up by value, so stale rows would linger and make a
 * clash between two short codes more likely. Hourly cron; idempotent.
 */
export const cleanup = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("authVerificationCodes")
      .withIndex("by_expirationTime", (q) => q.lt("expirationTime", Date.now()))
      .take(CLEANUP_BATCH);
    for (const row of expired) await ctx.db.delete("authVerificationCodes", row._id);
    if (expired.length === CLEANUP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.authCodeJobs.cleanup, {});
    }
    return { deleted: expired.length };
  },
});
