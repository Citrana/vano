import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "./errors";
import { onUserCreated, onUserDeleted } from "./platformStats";
import { ensureBuiltInRoles, findRoleByKey } from "./roles";
import { revokeSessions } from "./sessions";
import { readSettings } from "./settings";
import { inviteStateAt, isInviteToken } from "./team";
import { sha256Hex } from "../verification/codes";

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
 * Whether a new account may be created for `email` (CLAUDE.md "Roles &
 * permissions"): public sign-up is open, or a valid team invite comes with
 * it, or the terminal seed command left a live one-time permission for it.
 * Read-only: shared by `assertSignupAllowed` (account creation) and the
 * sign-up guard (`authSignup.signupState`), which must give the same
 * answer for registered and new emails. Returns the bypass row to use up.
 */
export async function signupAllowed(
  ctx: QueryCtx,
  email: string | undefined,
  invite: string | undefined,
  now: number,
): Promise<{ allowed: false } | { allowed: true; bypass: Doc<"signupBypasses"> | null }> {
  if ((await readSettings(ctx)).signupEnabled) return { allowed: true, bypass: null };
  // A valid team invite lets that person in (CLAUDE.md "Team accounts").
  // It isn't used up here: joining is still `team.acceptInvite`.
  if (invite !== undefined && (await inviteStillValid(ctx, invite, now))) return { allowed: true, bypass: null };
  const bypass = email
    ? await ctx.db
        .query("signupBypasses")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first()
    : null;
  return bypass && bypass.expiresAt >= now ? { allowed: true, bypass } : { allowed: false };
}

/**
 * While public sign-up is closed, refuses a new account (`signupAllowed`)
 * and uses up the seed command's one-time permission. Throwing aborts the
 * transaction, so the account is never created.
 */
async function assertSignupAllowed(
  ctx: MutationCtx,
  email: string | undefined,
  pendingInvite: string | undefined,
): Promise<void> {
  const result = await signupAllowed(ctx, email, pendingInvite, Date.now());
  if (!result.allowed) fail("SIGNUP_DISABLED");
  if (result.bypass) await ctx.db.delete("signupBypasses", result.bypass._id);
}

async function inviteStillValid(ctx: QueryCtx, token: string, now: number): Promise<boolean> {
  if (!isInviteToken(token)) return false;
  const tokenHash = await sha256Hex(token);
  const invite = await ctx.db
    .query("shopInvites")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  return invite !== null && inviteStateAt(invite, now) === "valid";
}

/**
 * After a new account is created: sign-up must be open (or the seed
 * command or a team invite allowed it), then seller role if missing +
 * users counter. A sign-up's invite token is never kept on the account.
 */
export async function setUpNewAccount(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const created = await ctx.db.get("users", userId);
  if (created && created.roleId === undefined) {
    await assertSignupAllowed(ctx, created.email, created.pendingInvite);
  }
  if (created?.pendingInvite !== undefined) await ctx.db.patch("users", userId, { pendingInvite: undefined });
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

/** The user's email + password login (Convex Auth `authAccounts`), if any. */
export async function passwordAccountOf(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"authAccounts"> | null> {
  return await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "password"))
    .unique();
}

/**
 * True when the login exists but its email was never confirmed with the
 * sign-up code (`emailVerified`, what Convex Auth checks before a session).
 * Such an account may belong to someone who registered another person's
 * address: it must never be promoted or marked verified (CLAUDE.md "Roles &
 * permissions"). A user with no login at all can't sign in, so it's not one.
 */
export function isUnverifiedLogin(account: Doc<"authAccounts"> | null): boolean {
  return account !== null && account.emailVerified === undefined;
}

/**
 * Deletes an unverified account so the seed can recreate the address
 * (`seed:superAdmin` with `replaceUnverified`). Refuses (SEED_ACCOUNT_IN_USE)
 * anything that looks used: a verified login, an owned shop, a team
 * membership or a role other than seller. Removes its codes, logins,
 * sessions and user row, and keeps the platform stats in step.
 */
export async function deleteUnverifiedAccount(ctx: MutationCtx, userId: Id<"users">): Promise<Doc<"users">> {
  const user = await ctx.db.get("users", userId);
  if (!user) fail("NOT_FOUND");
  const account = await passwordAccountOf(ctx, userId);
  if (!isUnverifiedLogin(account)) fail("SEED_ACCOUNT_IN_USE", "The account is verified: it is not replaced.");
  const seller = await findRoleByKey(ctx, "seller");
  const ownsShop = await ctx.db
    .query("shops")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
    .first();
  const membership = await ctx.db
    .query("shopMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (ownsShop || membership || (user.roleId !== undefined && user.roleId !== seller?._id)) {
    fail("SEED_ACCOUNT_IN_USE", "The unverified account owns a shop, belongs to a team or has a role: remove that first.");
  }

  for await (const login of ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))) {
    for await (const code of ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", login._id))) {
      await ctx.db.delete("authVerificationCodes", code._id);
    }
    await ctx.db.delete("authAccounts", login._id);
  }
  await revokeSessions(ctx, userId);
  await onUserDeleted(ctx, user);
  await ctx.db.delete("users", userId);
  return user;
}
