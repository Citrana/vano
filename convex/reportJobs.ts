import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { hasFeature } from "./lib/entitlements";
import { notify } from "./lib/notify";
import { monthOf, monthRange, previousMonth } from "./lib/salesRecords/report";
import { localDay, shopTimeZone } from "./lib/timeZone";

const BATCH = 100;

/**
 * Daily (convex/crons.ts): on each shop's own 1st of the month (in its
 * time zone), tells the seller last month's report is ready — only with
 * the `salesReports` plan feature and at least one confirmed sale that
 * month. Pages through every shop and reschedules itself; the dedupe key
 * makes it at most once per shop and month, so reruns are safe.
 */
export const monthly = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.number(),
  handler: async (ctx, { cursor }) => {
    const now = Date.now();
    const page = await ctx.db.query("shops").paginate({ numItems: BATCH, cursor: cursor ?? null });
    let sent = 0;
    for (const shop of page.page) {
      if (shop.status === "suspended") continue;
      const today = localDay(now, shopTimeZone(shop));
      if (!today.endsWith("-01")) continue;
      const month = previousMonth(monthOf(today));
      if (!(await hasFeature(ctx, shop, "salesReports"))) continue;
      const { from, to } = monthRange(month);
      let hasSale = false;
      for await (const record of ctx.db
        .query("salesRecords")
        .withIndex("by_shopId_and_day", (q) => q.eq("shopId", shop._id).gte("day", from).lte("day", to))) {
        if (record.status === "recorded") {
          hasSale = true;
          break;
        }
      }
      if (!hasSale) continue;
      sent += await notify(ctx, {
        data: { type: "report.ready", month },
        to: { shop },
        dedupeKey: `report.ready:${shop._id}:${month}`,
      });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.reportJobs.monthly, { cursor: page.continueCursor });
    return sent;
  },
});
