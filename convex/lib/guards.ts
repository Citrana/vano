import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hasPermission, type Access } from "./access";
import { fail } from "./errors";
import type { Permission } from "./permissions";
import { findRoleByKey, permissionsOf } from "./roles";

/**
 * Safety rules for admin actions (CLAUDE.md "Roles & permissions"). They
 * run on the server, after the permission check:
 *
 * 1. Nobody changes their own role or suspends themselves.
 * 2. The last active super admin can't be demoted or suspended.
 * 3. Only a super admin can touch a super admin or grant that role.
 * 4. No escalation: you can only hand out permissions you hold yourself.
 * 5. Built-in roles can't be edited or deleted; a role in use can't be deleted.
 */

/** True if every permission in `wanted` is one the caller holds. */
export function canGrant(access: Access, wanted: readonly Permission[]): boolean {
  return wanted.every((p) => hasPermission(access, p));
}

export function isSuperAdminUser(user: Doc<"users">, superAdminRole: Doc<"roles"> | null) {
  return superAdminRole !== null && user.roleId === superAdminRole._id;
}

/** Active super admins, counting at most 2 — all the "last one" rule needs. */
async function activeSuperAdminCount(ctx: QueryCtx, superAdminRole: Doc<"roles">) {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_roleId_and_status", (q) =>
      q.eq("roleId", superAdminRole._id).eq("status", "active"),
    )
    .take(2);
  return rows.length;
}

/**
 * Checks the caller may change `target`'s role and/or status. `change`
 * describes the result: the new role, and whether they'll still be active.
 */
export async function assertCanChangeUser(
  ctx: QueryCtx,
  access: Access,
  target: Doc<"users">,
  change: { role?: Doc<"roles">; active?: boolean },
): Promise<void> {
  if (target._id === access.user._id) fail("CANNOT_MODIFY_SELF");

  const superAdminRole = await findRoleByKey(ctx, "super_admin");
  const targetIsSuperAdmin = isSuperAdminUser(target, superAdminRole);
  const grantsSuperAdmin = change.role?.key === "super_admin";
  if ((targetIsSuperAdmin || grantsSuperAdmin) && !access.isSuperAdmin) fail("FORBIDDEN");

  if (change.role && !canGrant(access, permissionsOf(change.role))) {
    fail("PERMISSION_ESCALATION");
  }

  const losesSuperAdmin =
    targetIsSuperAdmin &&
    target.status !== "suspended" &&
    ((change.role !== undefined && change.role.key !== "super_admin") || change.active === false);
  if (losesSuperAdmin && superAdminRole && (await activeSuperAdminCount(ctx, superAdminRole)) <= 1) {
    fail("LAST_SUPER_ADMIN");
  }
}

/** Checks the caller may create or edit a custom role with these permissions. */
export function assertCanWriteRole(
  access: Access,
  role: Doc<"roles"> | null,
  permissions: readonly Permission[],
): void {
  if (role?.key !== undefined) fail("ROLE_BUILT_IN");
  if (role && access.user.roleId === role._id && !access.isSuperAdmin) {
    fail("CANNOT_MODIFY_SELF");
  }
  if (!canGrant(access, permissions)) fail("PERMISSION_ESCALATION");
  // Editing a role can also take permissions away from its holders, which
  // is only allowed for someone who could have granted them.
  if (role && !canGrant(access, permissionsOf(role))) fail("PERMISSION_ESCALATION");
}

/** Checks a custom role can be deleted: not built-in, not in use. */
export async function assertCanDeleteRole(
  ctx: QueryCtx,
  access: Access,
  role: Doc<"roles">,
): Promise<void> {
  assertCanWriteRole(access, role, []);
  const holder = await ctx.db
    .query("users")
    .withIndex("by_roleId_and_status", (q) => q.eq("roleId", role._id))
    .first();
  if (holder) fail("ROLE_IN_USE");
}
