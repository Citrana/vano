import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { fail } from "./errors";
import { onUserCreated } from "./platformStats";
import { ensureBuiltInRoles } from "./roles";
import { readSettings } from "./settings";

/** How long a seed command's sign-up permission stays valid. */
export const SIGNUP_BYPASS_MS = 5 * 60 * 1000;

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

/**
 * While public sign-up is closed, refuses a new account unless the
 * terminal seed command left a one-time permission for its email (used up
 * here). Throwing aborts the transaction, so the account is never created.
 */
async function assertSignupAllowed(ctx: MutationCtx, email: string | undefined): Promise<void> {
  if ((await readSettings(ctx)).signupEnabled) return;
  const bypass = email
    ? await ctx.db
        .query("signupBypasses")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first()
    : null;
  if (!bypass || bypass.expiresAt < Date.now()) fail("SIGNUP_DISABLED");
  await ctx.db.delete("signupBypasses", bypass._id);
}

/**
 * After a new account is created: sign-up must be open (or the seed
 * command allowed it), then seller role if missing + users counter.
 */
export async function setUpNewAccount(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const created = await ctx.db.get("users", userId);
  if (created && created.roleId === undefined) await assertSignupAllowed(ctx, created.email);
  await assignSellerRoleIfMissing(ctx, userId);
  const user = await ctx.db.get("users", userId);
  if (user) await onUserCreated(ctx, user);
}

/** Before every new session (sign-in or sign-up): suspended users can't log in. */
export async function assertCanStartSession(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get("users", userId);
  if (user?.status === "suspended") fail("ACCOUNT_SUSPENDED");
}
