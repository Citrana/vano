import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireCurrentUser } from "./auth";
import { fail } from "./errors";
import { ADMIN_PERMISSIONS, SELLER_PERMISSIONS, type Permission } from "./permissions";
import { permissionsOf } from "./roles";

/**
 * Who the caller is and what they may do (CLAUDE.md "Roles &
 * permissions"). Every authenticated Convex function goes through
 * `loadAccess`: signed-out callers get NOT_AUTHENTICATED, suspended ones
 * ACCOUNT_SUSPENDED — whatever their role.
 */
export type Access = {
  user: Doc<"users">;
  /** Null only for users not migrated yet (treated as sellers). */
  role: Doc<"roles"> | null;
  permissions: ReadonlySet<Permission>;
  isSuperAdmin: boolean;
};

export async function loadAccess(ctx: QueryCtx | MutationCtx): Promise<Access> {
  const user = await requireCurrentUser(ctx);
  if (user.status === "suspended") fail("ACCOUNT_SUSPENDED");
  return await accessOf(ctx, user);
}

/**
 * The user's role and permissions, without the signed-in / suspended
 * checks. Only `loadAccess` and `users.viewer` (which must not throw for a
 * suspended user) call this directly.
 */
export async function accessOf(ctx: QueryCtx | MutationCtx, user: Doc<"users">): Promise<Access> {
  const role = user.roleId ? await ctx.db.get("roles", user.roleId) : null;
  // Missing role (pre-migration user, or a dangling id) = least privilege.
  const permissions = new Set(role ? permissionsOf(role) : SELLER_PERMISSIONS);
  return { user, role, permissions, isSuperAdmin: role?.key === "super_admin" };
}

export function hasPermission(access: Access, permission: Permission): boolean {
  return access.isSuperAdmin || access.permissions.has(permission);
}

export function requirePermission(access: Access, permission: Permission): void {
  if (!hasPermission(access, permission)) fail("FORBIDDEN");
}

/** One permission, or a list meaning "any of these". */
export type PermissionRequirement = Permission | readonly Permission[];

export function requireAnyPermission(access: Access, required: PermissionRequirement): void {
  const list: readonly Permission[] = typeof required === "string" ? [required] : required;
  if (!list.some((p) => hasPermission(access, p))) fail("FORBIDDEN");
}

/** True when the caller may open /admin at all. */
export function isAdmin(access: Access): boolean {
  return ADMIN_PERMISSIONS.some((p) => hasPermission(access, p));
}

export type PermissionArg = { permission: PermissionRequirement };

/** Loads the caller's access and checks the function's declared permission. */
export async function accessWith(ctx: QueryCtx | MutationCtx, { permission }: PermissionArg) {
  const access = await loadAccess(ctx);
  requireAnyPermission(access, permission);
  return { user: access.user, access };
}

/**
 * Admin functions: `adminQuery({ permission: "users.view", args, handler })`.
 * The permission is checked on the server before the handler runs.
 */
export const adminQuery = customQuery(
  query,
  customCtx((ctx: QueryCtx, extra: PermissionArg) => accessWith(ctx, extra)),
);

export const adminMutation = customMutation(
  mutation,
  customCtx((ctx: MutationCtx, extra: PermissionArg) => accessWith(ctx, extra)),
);

type WithAccess<C> = C & { user: Doc<"users">; access: Access };
export type AdminQueryCtx = WithAccess<QueryCtx>;
export type AdminMutationCtx = WithAccess<MutationCtx>;
