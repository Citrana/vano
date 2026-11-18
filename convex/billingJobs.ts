import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { expireIfDue, stateOf, writeSubscription } from "./lib/subscriptions";

/**
 * Scheduled billing work (convex/crons.ts, CLAUDE.md "Billing").
 *
 * expireDue: trials and paid plans whose period has ended move to Free
 * (trialing → free, active → expired). Data is never touched: limits are
 * computed from the plan, so extra products are simply hidden. Processes
 * one batch per run and reschedules itself while more are due.
 */

const BATCH = 100;
const ENDING = ["trialing", "active"] as const;

export const expireDue = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let processed = 0;
    for (const status of ENDING) {
      const due = await ctx.db
        .query("subscriptions")
        .withIndex("by_status_and_periodEnd", (q) =>
          q.eq("status", status).gte("periodEnd", 0).lte("periodEnd", now),
        )
        .take(BATCH - processed);
      for (const sub of due) {
        processed++;
        const shop = await ctx.db.get("shops", sub.shopId);
        if (!shop) {
          // Left behind by a deleted shop: nothing to bill.
          await ctx.db.delete("subscriptions", sub._id);
          continue;
        }
        const next = expireIfDue(stateOf(sub), now);
        if (next === null) continue;
        await writeSubscription(ctx, shop, next, {
          source: "system",
          action: sub.status === "trialing" ? "subscription.trialEnded" : "subscription.expired",
          actor: null,
          details: { previousPlan: sub.plan },
        });
      }
      if (processed >= BATCH) break;
    }
    if (processed >= BATCH) await ctx.scheduler.runAfter(0, internal.billingJobs.expireDue, {});
    return processed;
  },
});
