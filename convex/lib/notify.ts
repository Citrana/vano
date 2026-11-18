import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { NotificationKind } from "../notifications/kinds";
import { activeChannels } from "../notifications/registry";

/**
 * Seller notifications (CLAUDE.md "Protected shop changes"). The row is
 * the in-app delivery (dashboard notice + Shop settings badge); extra
 * channels from `NOTIFY_CHANNELS` (convex/notifications/registry.ts) get
 * it in a scheduled action, so a slow provider never blocks the decision.
 */
export async function notifySeller(
  ctx: MutationCtx,
  entry: { userId: Id<"users">; shopId: Id<"shops">; kind: NotificationKind; requestId: Id<"shopChangeRequests"> },
): Promise<Id<"sellerNotifications">> {
  const id = await ctx.db.insert("sellerNotifications", entry);
  if (activeChannels().length > 0) {
    await ctx.scheduler.runAfter(0, internal.notifications.deliver.send, { notificationId: id });
  }
  return id;
}
