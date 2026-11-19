import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { adminQuery, hasPermission } from "../lib/access";
import { ADMIN_PERMISSIONS } from "../lib/permissions";
import { DAY_MS, EXPIRY_WARNING_DAYS } from "../lib/plans";
import { COUNT_CAP, FAILED_PAYMENT_WINDOW_DAYS } from "../notifications/config";

/**
 * Live "needs attention" numbers for the admin sidebar badges and the
 * dashboard cards (CLAUDE.md "Notifications"). Counted from the real
 * tables, never from notifications, so they always match the lists.
 * Each number is null when the caller lacks the permission behind it.
 * `now` comes from the client (queries can't read the clock); round it so
 * the query stays cached.
 */

const countValidator = v.object({ count: v.number(), capped: v.boolean() });
type Count = { count: number; capped: boolean };
const nullable = v.union(countValidator, v.null());

/** Pending requests are few; this bounds the scan, not the real number. */
const PENDING_SCAN = 500;

function capped(n: number, full = false): Count {
  return { count: Math.min(n, COUNT_CAP), capped: full || n > COUNT_CAP };
}

export const counts = adminQuery({
  permission: ADMIN_PERMISSIONS,
  args: { now: v.number() },
  returns: v.object({
    pendingChangeRequests: nullable,
    flaggedChangeRequests: nullable,
    failedPayments: nullable,
    endingSoon: nullable,
  }),
  handler: async (ctx, { now }) => {
    const canChanges = hasPermission(ctx.access, "changeRequests.view");
    const canBilling = hasPermission(ctx.access, "billing.view");
    const changes = canChanges ? await changeRequestCounts(ctx) : null;
    return {
      pendingChangeRequests: changes?.pending ?? null,
      flaggedChangeRequests: changes?.flagged ?? null,
      failedPayments: canBilling ? await unresolvedFailedPayments(ctx, now) : null,
      endingSoon: canBilling ? await endingSoonCount(ctx, now) : null,
    };
  },
});

async function changeRequestCounts(ctx: QueryCtx): Promise<{ pending: Count; flagged: Count }> {
  const pending = await ctx.db
    .query("shopChangeRequests")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .take(PENDING_SCAN);
  const full = pending.length === PENDING_SCAN;
  const flagged = pending.filter((r) => r.flags.includes("brand")).length;
  return { pending: capped(pending.length, full), flagged: capped(flagged, full) };
}

/** Failed payments in the window whose shop hasn't paid successfully since. */
async function unresolvedFailedPayments(ctx: QueryCtx, now: number): Promise<Count> {
  const failed = await ctx.db
    .query("payments")
    .withIndex("by_status", (q) => q.eq("status", "failed").gte("_creationTime", now - FAILED_PAYMENT_WINDOW_DAYS * DAY_MS))
    .order("desc")
    .take(COUNT_CAP * 2);
  const lastSuccess = new Map<string, number>();
  let n = 0;
  for (const payment of failed) {
    if (!lastSuccess.has(payment.shopId)) {
      const success = await ctx.db
        .query("payments")
        .withIndex("by_shopId_and_status", (q) => q.eq("shopId", payment.shopId).eq("status", "succeeded"))
        .order("desc")
        .first();
      lastSuccess.set(payment.shopId, success?._creationTime ?? 0);
    }
    if ((lastSuccess.get(payment.shopId) ?? 0) <= payment._creationTime) n++;
  }
  return capped(n, failed.length === COUNT_CAP * 2);
}

/** Trials and paid plans ending within `EXPIRY_WARNING_DAYS`. */
async function endingSoonCount(ctx: QueryCtx, now: number): Promise<Count> {
  const until = now + EXPIRY_WARNING_DAYS * DAY_MS;
  let n = 0;
  for (const status of ["trialing", "active"] as const) {
    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_status_and_periodEnd", (q) => q.eq("status", status).gt("periodEnd", now).lte("periodEnd", until))
      .take(COUNT_CAP + 1);
    n += rows.length;
  }
  return capped(n);
}
