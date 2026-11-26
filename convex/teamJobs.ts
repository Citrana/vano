import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { ACTIVITY_RETENTION_DAYS, INVITE_KEEP_DAYS } from "./lib/team";

const BATCH = 200;
const DAY_MS = 86_400_000;

/**
 * Daily (crons.ts, CLAUDE.md "Team accounts"): deletes invites that ended
 * (expired, used or revoked) more than INVITE_KEEP_DAYS ago, and activity
 * older than ACTIVITY_RETENTION_DAYS. Runs in batches and reschedules
 * itself until nothing is left. Members are never deleted here.
 */
export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const keepAfter = now - INVITE_KEEP_DAYS * DAY_MS;
    const expired = await ctx.db
      .query("shopInvites")
      .withIndex("by_status_and_expiresAt", (q) => q.eq("status", "pending").lt("expiresAt", keepAfter))
      .take(BATCH);
    const used = await ctx.db
      .query("shopInvites")
      .withIndex("by_status_and_endedAt", (q) => q.eq("status", "accepted").lt("endedAt", keepAfter))
      .take(BATCH);
    const revoked = await ctx.db
      .query("shopInvites")
      .withIndex("by_status_and_endedAt", (q) => q.eq("status", "revoked").lt("endedAt", keepAfter))
      .take(BATCH);
    for (const row of [...expired, ...used, ...revoked]) await ctx.db.delete("shopInvites", row._id);
    const activity = await ctx.db
      .query("shopActivity")
      .withIndex("by_at", (q) => q.lt("at", now - ACTIVITY_RETENTION_DAYS * DAY_MS))
      .take(BATCH);
    for (const row of activity) await ctx.db.delete("shopActivity", row._id);
    if ([expired, used, revoked, activity].some((rows) => rows.length === BATCH)) {
      await ctx.scheduler.runAfter(0, internal.teamJobs.cleanup, {});
    }
    return null;
  },
});
