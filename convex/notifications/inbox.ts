import { filter } from "convex-helpers/server/filter";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { accountMutation, accountQuery, hasPermission, type Access } from "../lib/access";
import { fail } from "../lib/errors";
import { isPermission, type Permission } from "../lib/permissions";
import { shopAccessFor } from "../lib/shopAccess";
import { COUNT_CAP, INBOX_PREVIEW } from "./config";
import { notificationCategoryValidator, notificationDataValidator } from "./types";

/**
 * The caller's notifications (bell, notifications page). Every function
 * only reads or changes rows whose `userId` is the caller, and hides rows
 * whose `requiredPermission` the caller no longer holds. Marking read
 * isn't a shop write, so it works for a suspended shop's seller too.
 */

const itemValidator = v.object({
  _id: v.id("notifications"),
  _creationTime: v.number(),
  data: notificationDataValidator,
  read: v.boolean(),
  /** The shop a team notification is about (opening it switches to that shop). */
  shopId: v.union(v.id("shops"), v.null()),
});

/**
 * Whether the caller may still see a row. Unknown permissions = hidden. A
 * team notification (`shopId`) needs the permission in THAT shop, so a
 * changed role, a removal or a paused membership hides old rows too
 * (CLAUDE.md "Team accounts"). Shop access is computed once per shop.
 */
export function visibility(ctx: QueryCtx, access: Access) {
  const shops = new Map<Id<"shops">, Promise<ReadonlySet<Permission> | null>>();
  const permissionsIn = (shopId: Id<"shops">) => {
    let found = shops.get(shopId);
    if (!found) {
      found = (async () => {
        const shop = await ctx.db.get("shops", shopId);
        return shop ? ((await shopAccessFor(ctx, access, shop))?.permissions ?? null) : null;
      })();
      shops.set(shopId, found);
    }
    return found;
  };
  return async (row: Doc<"notifications">): Promise<boolean> => {
    const p = row.requiredPermission;
    if (row.shopId !== undefined) {
      const permissions = await permissionsIn(row.shopId);
      return permissions !== null && (p === undefined || (isPermission(p) && permissions.has(p)));
    }
    if (p === undefined) return true;
    return isPermission(p) && hasPermission(access, p);
  };
}

async function visibleRows(
  ctx: QueryCtx,
  access: Access,
  rows: readonly Doc<"notifications">[],
): Promise<Doc<"notifications">[]> {
  const can = visibility(ctx, access);
  const out: Doc<"notifications">[] = [];
  for (const row of rows) if (await can(row)) out.push(row);
  return out;
}

function toItem(row: Doc<"notifications">) {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    data: row.data,
    read: row.readAt !== undefined,
    shopId: row.shopId ?? null,
  };
}

/** Unread notifications, counted up to `COUNT_CAP` ("99+" past it). */
export const unreadCount = accountQuery({
  args: {},
  returns: v.object({ count: v.number(), capped: v.boolean() }),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", ctx.user._id).eq("readAt", undefined))
      .order("desc")
      // Room for a few hidden rows without missing the cap.
      .take(COUNT_CAP * 2);
    const count = (await visibleRows(ctx, ctx.access, rows)).length;
    return { count: Math.min(count, COUNT_CAP), capped: count > COUNT_CAP };
  },
});

/** The newest notifications, for the bell's dropdown. */
export const latest = accountQuery({
  args: {},
  returns: v.array(itemValidator),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .take(INBOX_PREVIEW * 3);
    return (await visibleRows(ctx, ctx.access, rows)).slice(0, INBOX_PREVIEW).map(toItem);
  },
});

/** All notifications, newest first; optionally unread only and / or one category. */
export const list = accountQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    unreadOnly: v.optional(v.boolean()),
    category: v.optional(notificationCategoryValidator),
  },
  returns: paginationResultValidator(itemValidator),
  handler: async (ctx, { paginationOpts, unreadOnly, category }) => {
    const userId = ctx.user._id;
    const table = ctx.db.query("notifications");
    const query =
      category && unreadOnly
        ? table.withIndex("by_userId_and_category_and_readAt", (q) =>
            q.eq("userId", userId).eq("category", category).eq("readAt", undefined),
          )
        : category
          ? table.withIndex("by_userId_and_category", (q) => q.eq("userId", userId).eq("category", category))
          : unreadOnly
            ? table.withIndex("by_userId_and_readAt", (q) => q.eq("userId", userId).eq("readAt", undefined))
            : table.withIndex("by_userId", (q) => q.eq("userId", userId));
    const result = await filter(query.order("desc"), visibility(ctx, ctx.access)).paginate(paginationOpts);
    return { ...result, page: result.page.map(toItem) };
  },
});

/** Marks one of the caller's notifications read. Someone else's is NOT_FOUND. */
export const markRead = accountMutation({
  args: { id: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("notifications", id);
    if (!row || row.userId !== ctx.user._id || !(await visibility(ctx, ctx.access)(row))) fail("NOT_FOUND");
    if (row.readAt === undefined) await ctx.db.patch("notifications", id, { readAt: Date.now() });
    return null;
  },
});

const MARK_BATCH = 200;

/** Marks all the caller's notifications read (in batches past `MARK_BATCH`). */
export const markAllRead = accountMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await markBatch(ctx, ctx.user._id);
    return null;
  },
});

export const markAllReadStep = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await markBatch(ctx, userId);
    return null;
  },
});

async function markBatch(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const now = Date.now();
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_userId_and_readAt", (q) => q.eq("userId", userId).eq("readAt", undefined))
    .take(MARK_BATCH);
  for (const row of rows) await ctx.db.patch("notifications", row._id, { readAt: now });
  if (rows.length === MARK_BATCH) {
    await ctx.scheduler.runAfter(0, internal.notifications.inbox.markAllReadStep, { userId });
  }
}
