import { v } from "convex/values";
import { protectedFieldValidator } from "../lib/changeRequests";
import { fail } from "../lib/errors";
import { sellerMutation, sellerQuery } from "../lib/seller";
import { notificationKindValidator } from "./kinds";

/**
 * In-app notifications for the caller (dashboard notice, Shop settings
 * badge). Reading them doesn't need a shop, so a suspended shop's seller
 * still sees decisions; marking read is a write and follows the usual
 * suspended-shop rule.
 */

const PERMISSION = "ownShop.manage" as const;

/** Unread notifications, newest first (at most 20). */
export const unread = sellerQuery({
  permission: PERMISSION,
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("sellerNotifications"),
      _creationTime: v.number(),
      kind: notificationKindValidator,
      field: protectedFieldValidator,
      newValue: v.string(),
      reason: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("sellerNotifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", ctx.user._id).eq("readAt", undefined))
      .order("desc")
      .take(20);
    const result = [];
    for (const row of rows) {
      const request = await ctx.db.get("shopChangeRequests", row.requestId);
      if (!request) continue;
      result.push({
        _id: row._id,
        _creationTime: row._creationTime,
        kind: row.kind,
        field: request.field,
        newValue: request.newValue,
        reason: request.decisionReason ?? null,
      });
    }
    return result;
  },
});

/** Marks the caller's notifications read: one, or all when `id` is omitted. */
export const markRead = sellerMutation({
  permission: PERMISSION,
  args: { id: v.optional(v.id("sellerNotifications")) },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const now = Date.now();
    if (id) {
      const row = await ctx.db.get("sellerNotifications", id);
      if (!row || row.userId !== ctx.user._id) fail("NOT_FOUND");
      if (row.readAt === undefined) await ctx.db.patch("sellerNotifications", id, { readAt: now });
      return null;
    }
    const rows = await ctx.db
      .query("sellerNotifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", ctx.user._id).eq("readAt", undefined))
      .take(100);
    for (const row of rows) await ctx.db.patch("sellerNotifications", row._id, { readAt: now });
    return null;
  },
});
