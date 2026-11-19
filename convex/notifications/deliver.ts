import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalQuery } from "../_generated/server";
import { languageValidator } from "../lib/catalog";
import { findShopByOwner } from "../lib/seller";
import { activeChannels } from "./registry";
import { notificationDataValidator } from "./types";

const messageValidator = v.object({
  data: notificationDataValidator,
  recipient: v.object({
    email: v.union(v.string(), v.null()),
    whatsappNumber: v.union(v.string(), v.null()),
    language: languageValidator,
  }),
});

/** Everything a channel needs. Null if the notification or its user is gone. */
export const message = internalQuery({
  args: { notificationId: v.id("notifications") },
  returns: v.union(messageValidator, v.null()),
  handler: async (ctx, { notificationId }) => {
    const notification = await ctx.db.get("notifications", notificationId);
    if (!notification) return null;
    const user = await ctx.db.get("users", notification.userId);
    if (!user) return null;
    const shop = await findShopByOwner(ctx, user._id);
    return {
      data: notification.data,
      recipient: {
        email: user.email ?? null,
        whatsappNumber: shop?.whatsappNumber ?? null,
        language: shop?.language ?? "en",
      },
    };
  },
});

/** Sends one notification on every outside channel; a failing channel doesn't stop the others. */
export const send = internalAction({
  args: { notificationId: v.id("notifications") },
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
