import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  ALL_PERMISSIONS,
  cleanPermissions,
  SELLER_PERMISSIONS,
  type BuiltInRoleKey,
  type Permission,
} from "./permissions";

/** Default names of the built-in roles (renaming them is not allowed). */
export const BUILT_IN_ROLE_NAMES: Record<BuiltInRoleKey, string> = {
  super_admin: "Super admin",
  seller: "Seller",
};

export async function findRoleByKey(
  ctx: QueryCtx,
  key: BuiltInRoleKey,
): Promise<Doc<"roles"> | null> {
  return await ctx.db
    .query("roles")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

/** Creates the built-in roles if missing. Safe to call any number of times. */
export async function ensureBuiltInRoles(
  ctx: MutationCtx,
): Promise<Record<BuiltInRoleKey, Id<"roles">>> {
  const ids = {} as Record<BuiltInRoleKey, Id<"roles">>;
  for (const key of ["super_admin", "seller"] as const) {
    const existing = await findRoleByKey(ctx, key);
    ids[key] =
      existing?._id ??
      (await ctx.db.insert("roles", {
        name: BUILT_IN_ROLE_NAMES[key],
        key,
        permissions: [],
      }));
  }
  return ids;
}

/**
 * What a role can do. Super admin: everything, including permissions added
 * later. Seller: the fixed seller set. Custom: what's stored, minus
 * permissions that no longer exist.
 */
export function permissionsOf(role: Doc<"roles">): Permission[] {
  if (role.key === "super_admin") return [...ALL_PERMISSIONS];
  if (role.key === "seller") return [...SELLER_PERMISSIONS];
  return cleanPermissions(role.permissions);
}
