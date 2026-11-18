import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalQuery } from "../_generated/server";
import { languageValidator } from "../lib/catalog";
import { protectedFieldValidator } from "../lib/changeRequests";
import { notificationKindValidator } from "./kinds";
import { activeChannels } from "./registry";

const messageValidator = v.object({
  kind: notificationKindValidator,
  email: v.union(v.string(), v.null()),
  whatsappNumber: v.string(),
  language: languageValidator,
  shopName: v.string(),
  field: protectedFieldValidator,
  newValue: v.string(),
  reason: v.union(v.string(), v.null()),
});

/** Everything a channel needs to word the message. Null if anything is gone. */
export const message = internalQuery({
  args: { notificationId: v.id("sellerNotifications") },
  returns: v.union(messageValidator, v.null()),
  handler: async (ctx, { notificationId }) => {
    const notification = await ctx.db.get("sellerNotifications", notificationId);
    if (!notification) return null;
    const [request, shop, user] = await Promise.all([
      ctx.db.get("shopChangeRequests", notification.requestId),
      ctx.db.get("shops", notification.shopId),
      ctx.db.get("users", notification.userId),
    ]);
    if (!request || !shop || !user) return null;
    return {
      kind: notification.kind,
      email: user.email ?? null,
      whatsappNumber: shop.whatsappNumber,
      language: shop.language,
      shopName: shop.name,
      field: request.field,
      newValue: request.newValue,
      reason: request.decisionReason ?? null,
    };
  },
});

/** Sends one notification on every outside channel; a failing channel doesn't stop the others. */
export const send = internalAction({
  args: { notificationId: v.id("sellerNotifications") },
  returns: v.null(),
  handler: async (ctx, { notificationId }) => {
    const msg = await ctx.runQuery(internal.notifications.deliver.message, { notificationId });
    if (!msg) return null;
    for (const channel of activeChannels()) {
      try {
        await channel.send(msg);
      } catch (error) {
        console.error(`[notification] ${channel.id} failed`, error);
      }
    }
    return null;
  },
});
