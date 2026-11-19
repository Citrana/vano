import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { NOTIFICATION_TYPES, type NotificationData } from "../notifications/types";
import { activeChannels } from "../notifications/registry";
import type { Permission } from "./permissions";
import { permissionsOf } from "./roles";

/**
 * The one notification service (CLAUDE.md "Notifications"). Any feature
 * calls `notify` in the same mutation as the change it reports:
 *
 *   await notify(ctx, {
 *     data: { type: "payment.failed", paymentId, plan },
 *     to: { userId: payment.userId },
 *     dedupeKey: `pay.failed:${paymentId}`,
 *   });
 *
 * - `to` is one user, or everyone holding a permission (resolved through
 *   roles; super admins always included, suspended users skipped). The
 *   permission is stored on the row and checked again on every read.
 * - The same `dedupeKey` never reaches a user twice.
 * - The row is the in-app delivery. Outside channels (`NOTIFY_CHANNELS`,
 *   convex/notifications/registry.ts) get it in a scheduled action, so a
 *   slow provider never blocks the caller and callers never pick channels.
 */

export type Recipients = { userId: Id<"users"> } | { permission: Permission };

/** Upper bounds: admins are few; these only stop a runaway fan-out. */
const MAX_ROLES = 200;
const MAX_USERS_PER_ROLE = 500;

export async function notify(
  ctx: MutationCtx,
  input: {
    data: NotificationData;
    to: Recipients;
    dedupeKey: string;
    /** Never notified (e.g. the shop's owner, about their own shop). */
    exclude?: readonly Id<"users">[];
  },
): Promise<number> {
  const { category, audience } = NOTIFICATION_TYPES[input.data.type];
  const excluded = new Set<string>(input.exclude ?? []);
  const userIds = "userId" in input.to ? [input.to.userId] : await usersWithPermission(ctx, input.to.permission);
  const requiredPermission = "permission" in input.to ? input.to.permission : audience === "user" ? undefined : audience;

  const channels = activeChannels().length > 0;
  let created = 0;
  for (const userId of userIds) {
    if (excluded.has(userId)) continue;
    const seen = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_dedupeKey", (q) => q.eq("userId", userId).eq("dedupeKey", input.dedupeKey))
      .first();
    if (seen) continue;
    const notificationId = await ctx.db.insert("notifications", {
      userId,
      category,
      data: input.data,
      requiredPermission,
      dedupeKey: input.dedupeKey,
    });
    created++;
    if (channels) {
      await ctx.scheduler.runAfter(0, internal.notifications.deliver.send, { notificationId });
    }
  }
  return created;
}

/** Active users whose role grants `permission` (super admins included). */
export async function usersWithPermission(ctx: QueryCtx, permission: Permission): Promise<Id<"users">[]> {
  const roles = await ctx.db.query("roles").take(MAX_ROLES);
  const ids: Id<"users">[] = [];
  for (const role of roles) {
    if (!permissionsOf(role).includes(permission)) continue;
    const users = await ctx.db
      .query("users")
      .withIndex("by_roleId_and_status", (q) => q.eq("roleId", role._id).eq("status", "active"))
      .take(MAX_USERS_PER_ROLE);
    for (const user of users) ids.push(user._id);
  }
  return ids;
}
