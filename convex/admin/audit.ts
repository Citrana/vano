import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { adminQuery } from "../lib/access";
import { auditActionValidator, auditDetailsValidator, auditTargetTypeValidator } from "../lib/audit";

/**
 * Admin activity history (CLAUDE.md "Roles & permissions"): read-only
 * view of `auditLogs`, written by `logAdminAction` in every admin write.
 * Emails and labels are snapshots, so entries about deleted shops or
 * products still read correctly.
 */

/** Far-future bound so the date range can always sit inside the index. */
const END_OF_TIME = 8.64e15;

const actorFilter = v.union(v.id("users"), v.literal("system"));

const entry = v.object({
  _id: v.id("auditLogs"),
  at: v.number(),
  actorId: v.union(v.id("users"), v.null()),
  actorEmail: v.string(),
  action: auditActionValidator,
  targetType: auditTargetTypeValidator,
  targetId: v.string(),
  targetLabel: v.string(),
  details: v.union(auditDetailsValidator, v.null()),
});

/**
 * Newest first, filtered by person ("system" = terminal seed), action and
 * a [from, to) time range. Every filter combination uses an index; the
 * time range is on `_creationTime`, which Convex appends to each index.
 */
export const list = adminQuery({
  permission: "audit.view",
  args: {
    paginationOpts: paginationOptsValidator,
    actor: v.optional(actorFilter),
    action: v.optional(auditActionValidator),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  returns: paginationResultValidator(entry),
  handler: async (ctx, { paginationOpts, actor, action, from = 0, to = END_OF_TIME }) => {
    const actorId: Id<"users"> | undefined = actor === "system" ? undefined : actor;
    const logs = ctx.db.query("auditLogs");
    const query =
      actor !== undefined && action
        ? logs.withIndex("by_actorId_and_action", (q) =>
            q.eq("actorId", actorId).eq("action", action).gte("_creationTime", from).lt("_creationTime", to),
          )
        : actor !== undefined
          ? logs.withIndex("by_actorId", (q) =>
              q.eq("actorId", actorId).gte("_creationTime", from).lt("_creationTime", to),
            )
          : action
            ? logs.withIndex("by_action", (q) =>
                q.eq("action", action).gte("_creationTime", from).lt("_creationTime", to),
              )
            : logs.withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lt("_creationTime", to));

    const result = await query.order("desc").paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((log) => ({
        _id: log._id,
        at: log._creationTime,
        actorId: log.actorId ?? null,
        actorEmail: log.actorEmail,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        targetLabel: log.targetLabel,
        details: log.details ?? null,
      })),
    };
  },
});

/**
 * People for the "person" filter: everyone with a non-seller role
 * (super admins and custom roles), plus "system" in the UI. Someone later
 * demoted to seller isn't listed, but their entries stay in the history.
 */
export const actors = adminQuery({
  permission: "audit.view",
  args: {},
  returns: v.array(v.object({ _id: v.id("users"), email: v.string() })),
  handler: async (ctx) => {
    const roles = (await ctx.db.query("roles").take(200)).filter((r) => r.key !== "seller");
    const people = new Map<Id<"users">, string>();
    for (const role of roles) {
      const holders = await ctx.db
        .query("users")
        .withIndex("by_roleId_and_status", (q) => q.eq("roleId", role._id))
        .take(200);
      for (const user of holders) people.set(user._id, user.email ?? "");
    }
    return [...people]
      .map(([_id, email]) => ({ _id, email }))
      .sort((a, b) => a.email.localeCompare(b.email));
  },
});
