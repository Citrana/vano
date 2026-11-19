import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { utcDay } from "./lib/days";
import { notify } from "./lib/notify";
import { DAY_MS, EXPIRY_WARNING_DAYS } from "./lib/plans";
import { COUNT_CAP, NOTIFICATION_RETENTION_DAYS } from "./notifications/config";

/**
 * Scheduled notification work (convex/crons.ts, CLAUDE.md "Notifications").
 */

const ENDING = ["trialing", "active"] as const;
const ENDING_BATCH = 500;

/**
 * Daily: warns each seller whose trial or plan ends within
 * `EXPIRY_WARNING_DAYS` (once per period, deduped on its end), and sends
 * billing admins one summary per day when any are ending.
 */
export const endingSoon = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const until = now + EXPIRY_WARNING_DAYS * DAY_MS;
    let count = 0;
    for (const status of ENDING) {
      const due = await ctx.db
        .query("subscriptions")
        .withIndex("by_status_and_periodEnd", (q) => q.eq("status", status).gt("periodEnd", now).lte("periodEnd", until))
        .take(ENDING_BATCH);
      for (const sub of due) {
        if (sub.periodEnd === undefined) continue;
        const shop = await ctx.db.get("shops", sub.shopId);
        if (!shop) continue;
        count++;
        await notify(ctx, {
          data: { type: "plan.endingSoon", plan: sub.plan, trial: status === "trialing", periodEnd: sub.periodEnd },
          to: { userId: shop.ownerId },
          dedupeKey: `plan.endingSoon:${shop._id}:${sub.periodEnd}`,
        });
      }
    }
    if (count > 0) {
      const day = utcDay(now);
      await notify(ctx, {
        data: { type: "admin.endingSoon", count: Math.min(count, COUNT_CAP), capped: count > COUNT_CAP, day },
        to: { permission: "billing.view" },
        dedupeKey: `admin.endingSoon:${day}`,
      });
    }
    return count;
  },
});

const CLEANUP_BATCH = 500;

/** Daily: deletes notifications older than `NOTIFICATION_RETENTION_DAYS`, read or not. */
export const cleanup = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - NOTIFICATION_RETENTION_DAYS * DAY_MS;
    const old = await ctx.db
      .query("notifications")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(CLEANUP_BATCH);
    for (const row of old) await ctx.db.delete("notifications", row._id);
    if (old.length === CLEANUP_BATCH) await ctx.scheduler.runAfter(0, internal.notificationJobs.cleanup, {});
    return old.length;
  },
});
