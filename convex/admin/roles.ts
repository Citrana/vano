import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { fail } from "../lib/errors";
import { assertCanDeleteRole, assertCanWriteRole } from "../lib/guards";
import {
  cleanPermissions,
  ROLE_DESCRIPTION_MAX,
  roleKeyValidator,
  roleNameProblem,
  type Permission,
} from "../lib/permissions";
import { BUILT_IN_ROLE_NAMES, permissionsOf } from "../lib/roles";

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

const roleInput = {
  name: v.string(),
  description: v.optional(v.string()),
  permissions: v.array(v.string()),
};

/**
 * Validates a role form (same helpers as the client schema). Names are
 * unique ignoring case, built-in names included; unknown permissions are
 * dropped.
 */
async function cleanRoleInput(
  ctx: QueryCtx,
  input: { name: string; description?: string; permissions: string[] },
  self?: Id<"roles">,
): Promise<{ name: string; description: string | undefined; permissions: Permission[] }> {
  const name = input.name.trim();
  if (roleNameProblem(name) !== null) fail("ROLE_NAME_INVALID");
  const description = input.description?.trim() || undefined;
  if (description && description.length > ROLE_DESCRIPTION_MAX) fail("DESCRIPTION_TOO_LONG");

  // Only custom roles are ever written here, so built-in names are simply
  // reserved (even before the built-in rows exist).
  const lower = name.toLowerCase();
  const reserved = Object.values(BUILT_IN_ROLE_NAMES).some((n) => n.toLowerCase() === lower);
  const roles = await ctx.db.query("roles").take(200);
  const taken = roles.some((r) => r._id !== self && r.name.toLowerCase() === lower);
  if (reserved || taken) fail("ROLE_NAME_TAKEN");

  return { name, description, permissions: cleanPermissions(input.permissions) };
}

/** Creates a custom role. You can only grant permissions you hold. */
export const create = adminMutation({
  permission: "roles.manage",
  args: roleInput,
  returns: v.id("roles"),
  handler: async (ctx, args) => {
    const input = await cleanRoleInput(ctx, args);
    assertCanWriteRole(ctx.access, null, input.permissions);
    const roleId = await ctx.db.insert("roles", input);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "role.create",
      targetType: "role",
      targetId: roleId,
      targetLabel: input.name,
      details: { permissions: input.permissions.join(", ") },
    });
    return roleId;
  },
});

/**
 * Edits a custom role. Built-in roles and (for non-super admins) your own
 * role can't be edited; you can neither add nor remove permissions you
 * don't hold. Holders get the change immediately.
 */
export const update = adminMutation({
  permission: "roles.manage",
  args: { roleId: v.id("roles"), ...roleInput },
  returns: v.null(),
  handler: async (ctx, { roleId, ...args }) => {
    const role = await ctx.db.get("roles", roleId);
    if (!role) fail("NOT_FOUND");
    // Built-in / own-role / escalation checks come before input validation,
    // so a built-in role is always reported as ROLE_BUILT_IN.
    assertCanWriteRole(ctx.access, role, cleanPermissions(args.permissions));
    const input = await cleanRoleInput(ctx, args, roleId);

    const before = cleanPermissions(role.permissions);
    const added = input.permissions.filter((p) => !before.includes(p));
    const removed = before.filter((p) => !input.permissions.includes(p));
    await ctx.db.replace("roles", roleId, input);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "role.update",
      targetType: "role",
      targetId: roleId,
      targetLabel: input.name,
      details: {
        added: added.join(", "),
        removed: removed.join(", "),
        ...(role.name !== input.name ? { renamedFrom: role.name } : {}),
      },
    });
    return null;
  },
});

/** Deletes a custom role nobody has (suspended users count). */
export const remove = adminMutation({
  permission: "roles.manage",
  args: { roleId: v.id("roles") },
  returns: v.null(),
  handler: async (ctx, { roleId }) => {
    const role = await ctx.db.get("roles", roleId);
    if (!role) fail("NOT_FOUND");
    await assertCanDeleteRole(ctx, ctx.access, role);
    await ctx.db.delete("roles", roleId);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "role.delete",
      targetType: "role",
      targetId: roleId,
      targetLabel: role.name,
    });
    return null;
  },
});
