import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { logAdminAction } from "./lib/audit";
import { valueLabel } from "./lib/planFeatures";

/**
 * Shop exceptions end by themselves (CLAUDE.md "Billing"). `expire` is
 * scheduled at each exception's `endsAt` by `admin/planExceptions.grant`;
 * the hourly `sweep` catches any that were missed. Both are idempotent.
 */

const BATCH = 100;

async function end(ctx: MutationCtx, exception: Doc<"planExceptions">, now: number): Promise<void> {
  await ctx.db.patch("planExceptions", exception._id, { active: false, endedAt: now, endedReason: "expired" });
  const shop = await ctx.db.get("shops", exception.shopId);
  await logAdminAction(ctx, {
    actor: null,
    action: "planException.expired",
    targetType: "shop",
    targetId: exception.shopId,
    targetLabel: shop?.name ?? "",
    details: { feature: exception.feature, value: valueLabel(exception.value) },
  });
}

export const expire = internalMutation({
  args: { exceptionId: v.id("planExceptions") },
  returns: v.null(),
  handler: async (ctx, { exceptionId }) => {
    const exception = await ctx.db.get("planExceptions", exceptionId);
    const now = Date.now();
    if (exception && exception.active && exception.endsAt <= now) await end(ctx, exception, now);
    return null;
  },
});

export const sweep = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("planExceptions")
      .withIndex("by_active_and_endsAt", (q) => q.eq("active", true).lte("endsAt", now))
      .take(BATCH);
    for (const exception of due) await end(ctx, exception, now);
    if (due.length === BATCH) await ctx.scheduler.runAfter(0, internal.planExceptionJobs.sweep, {});
    return due.length;
  },
});
