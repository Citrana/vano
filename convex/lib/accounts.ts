import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { fail } from "./errors";
import { ensureBuiltInRoles } from "./roles";

/**
 * Account lifecycle hooks, called from the Convex Auth callbacks in
 * `convex/auth.ts` (CLAUDE.md "Roles & permissions").
 */

/**
 * After sign-up: a user without a role becomes an active seller. Nothing
 * from the sign-up form is read, so public sign-up can never pick a role,
 * and an existing role (e.g. a seeded super admin) is never overwritten.
 */
export async function assignSellerRoleIfMissing(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get("users", userId);
  if (!user || user.roleId !== undefined) return;
  const { seller } = await ensureBuiltInRoles(ctx);
  await ctx.db.patch("users", userId, { roleId: seller, status: user.status ?? "active" });
}

/** Before every new session (sign-in or sign-up): suspended users can't log in. */
export async function assertCanStartSession(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get("users", userId);
  if (user?.status === "suspended") fail("ACCOUNT_SUSPENDED");
}
