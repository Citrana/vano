import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { adminQuery } from "../lib/access";
import { roleKeyValidator } from "../lib/permissions";
import { permissionsOf } from "../lib/roles";

/**
 * Admin roles section (CLAUDE.md "Roles & permissions"). Reads need
 * `roles.view`; create / update / remove need `roles.manage` and run the
 * safety rules from `convex/lib/guards.ts`.
 */

/** Holders counted up to this; the UI shows "100+" beyond. */
const USER_COUNT_CAP = 100;

async function holderCount(ctx: QueryCtx, role: Doc<"roles">) {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_roleId_and_status", (q) => q.eq("roleId", role._id))
    .take(USER_COUNT_CAP + 1);
  return { userCount: Math.min(rows.length, USER_COUNT_CAP), userCountCapped: rows.length > USER_COUNT_CAP };
}

const roleFields = {
  _id: v.id("roles"),
  key: v.union(roleKeyValidator, v.null()),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  /** Effective permissions: everything for super admin, the fixed set for seller. */
  permissions: v.array(v.string()),
  userCount: v.number(),
  userCountCapped: v.boolean(),
};

async function describeRole(ctx: QueryCtx, role: Doc<"roles">) {
  return {
    _id: role._id,
    key: role.key ?? null,
    name: role.name,
    description: role.description ?? null,
    permissions: permissionsOf(role),
    ...(await holderCount(ctx, role)),
  };
}

const BUILT_IN_ORDER = { super_admin: 0, seller: 1 } as const;

/** Built-in roles first (super admin, seller), then custom roles by name. */
export const list = adminQuery({
  permission: "roles.view",
  args: {},
  returns: v.array(v.object(roleFields)),
  handler: async (ctx) => {
    const roles = await ctx.db.query("roles").take(200);
    roles.sort((a, b) => {
      const ra = a.key ? BUILT_IN_ORDER[a.key] : 2;
      const rb = b.key ? BUILT_IN_ORDER[b.key] : 2;
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
    });
    return await Promise.all(roles.map((role) => describeRole(ctx, role)));
  },
});

/**
 * One role, or null for an unknown / mistyped id. `isBuiltIn` / `isOwnRole`
 * only decide whether the page offers editing; the mutations re-check.
 */
export const get = adminQuery({
  permission: "roles.view",
  args: { roleId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ ...roleFields, isBuiltIn: v.boolean(), isOwnRole: v.boolean() }),
  ),
  handler: async (ctx, args) => {
    const roleId = ctx.db.normalizeId("roles", args.roleId);
    const role = roleId ? await ctx.db.get("roles", roleId) : null;
    if (!role) return null;
    return {
      ...(await describeRole(ctx, role)),
      isBuiltIn: role.key !== undefined,
      isOwnRole: ctx.user.roleId === role._id,
    };
  },
});
