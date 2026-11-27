import { createAccount, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, type ActionCtx, type QueryCtx } from "./_generated/server";
import { deleteUnverifiedAccount, isUnverifiedLogin, passwordAccountOf, SIGNUP_BYPASS_MS } from "./lib/accounts";
import { logAdminAction } from "./lib/audit";
import { normalizeEmail, passwordProblem } from "./lib/credentials";
import { fail } from "./lib/errors";
import { ensureBuiltInRoles } from "./lib/roles";
import { revokeSessions } from "./lib/sessions";
import { readSettings } from "./lib/settings";

/**
 * Creates a super admin from the terminal (README "First super admin"):
 *
 *   npx convex run seed:superAdmin '{"email":"you@example.com","password":"..."}'
 *
 * Every function in this file is internal: only the CLI / dashboard can run
 * them, never the browser (tested). Rules (CLAUDE.md "Roles & permissions"):
 *
 * - No account for the email: a new one is created with the password and
 *   marked verified by the seed itself (`created`).
 * - An UNVERIFIED account (nobody confirmed the address) is never promoted:
 *   it may be someone else's squatting the email. Refused, unless
 *   `replaceUnverified: true` deletes it and creates a fresh account
 *   (`replaced_unverified`).
 * - A VERIFIED account is changed only with `promoteExisting: true`: the
 *   password is reset to the one given, every session is signed out and it
 *   becomes super admin (`promoted`). Without the flag it's refused, so the
 *   password argument is never silently ignored.
 * - Already an active super admin: nothing changes (`already_super_admin`),
 *   unless `promoteExisting` asks to reset the password.
 * - Another active super admin exists: refused unless `force`.
 */

const resultValidator = v.object({
  result: v.union(
    v.literal("created"),
    v.literal("replaced_unverified"),
    v.literal("promoted"),
    v.literal("already_super_admin"),
  ),
  email: v.string(),
  passwordReset: v.boolean(),
  sessionsRevoked: v.boolean(),
  /** What happened, in one sentence (printed by `npx convex run`). */
  message: v.string(),
});
type SeedResult = Infer<typeof resultValidator>;

export const superAdmin = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    /** Allow another super admin when one already exists. */
    force: v.optional(v.boolean()),
    /** Change an existing verified account: reset its password, sign it out, promote it. */
    promoteExisting: v.optional(v.boolean()),
    /** Delete an unverified account using this email and create a fresh one. */
    replaceUnverified: v.optional(v.boolean()),
  },
  returns: resultValidator,
  handler: async (ctx, args): Promise<SeedResult> => {
    const email = normalizeEmail(args.email);
    if (email === null) fail("EMAIL_INVALID");
    if (passwordProblem(args.password) !== null) fail("PASSWORD_TOO_SHORT");
    const force = args.force ?? false;

    const existing: PrepareResult = await ctx.runMutation(internal.seed.prepare, { email });
    // Checked before anything is written, so a refused run leaves nothing
    // behind. `promote` checks again atomically.
    const refuseAnotherSuperAdmin = () => {
      if (existing.otherActiveSuperAdmin && !force) {
        fail("SUPER_ADMIN_EXISTS", "Another active super admin exists. Pass \"force\": true to add one more.");
      }
    };

    if (existing.userId === null) {
      refuseAnotherSuperAdmin();
      await createVerifiedSuperAdmin(ctx, email, args.password, force);
      return done("created", email, false, `Created a new super admin account for ${email}. Log in at /login.`);
    }

    if (!existing.verified) {
      if (!args.replaceUnverified) {
        fail(
          "SEED_UNVERIFIED_ACCOUNT",
          `An account for ${email} exists but its email was never verified, so it may not belong to the owner ` +
            "of this address. It was not promoted. Pass \"replaceUnverified\": true to delete it and create a fresh account with your password.",
        );
      }
      refuseAnotherSuperAdmin();
      await ctx.runMutation(internal.seed.replaceUnverified, { userId: existing.userId, email });
      await createVerifiedSuperAdmin(ctx, email, args.password, force);
      return done(
        "replaced_unverified",
        email,
        false,
        `Deleted the unverified account for ${email} and created a new super admin account with your password. Log in at /login.`,
      );
    }

    if (!args.promoteExisting) {
      if (existing.isSuperAdmin) {
        return done(
          "already_super_admin",
          email,
          false,
          `${email} is already an active super admin. Nothing changed; the password was NOT changed (pass "promoteExisting": true to reset it).`,
        );
      }
      fail(
        "SEED_EXISTING_ACCOUNT",
        `A verified account for ${email} already exists. It was not changed and the password was not used. ` +
          "Pass \"promoteExisting\": true to reset its password to the one given, sign it out everywhere and make it super admin.",
      );
    }

    if (!existing.isSuperAdmin) refuseAnotherSuperAdmin();
    // The new password first, then the role and the sign-out in one
    // transaction, so no session made with the old password survives.
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: email, secret: args.password } });
    await ctx.runMutation(internal.seed.promote, {
      userId: existing.userId,
      force,
      markVerified: false,
      revokeSessions: true,
    });
    return existing.isSuperAdmin
      ? done("already_super_admin", email, true, `${email} was already a super admin: password reset and every session signed out.`)
      : done("promoted", email, true, `Promoted ${email} to super admin: password reset to the one given and every session signed out.`);
  },
});

function done(result: SeedResult["result"], email: string, changedExisting: boolean, message: string): SeedResult {
  return { result, email, passwordReset: changedExisting, sessionsRevoked: changedExisting, message };
}

/**
 * Creates the account (same path as sign-up: the Password provider hashes
 * the secret, the auth callback makes it a seller), then promotes it. Only
 * here is an address marked verified by the seed: it just created it.
 */
async function createVerifiedSuperAdmin(ctx: ActionCtx, email: string, password: string, force: boolean): Promise<void> {
  // If public sign-up is closed, allow exactly this account (one-time, short-lived).
  await ctx.runMutation(internal.seed.allowSignup, { email });
  const { user } = await createAccount(ctx, {
    provider: "password",
    account: { id: email, secret: password },
    profile: { email },
  });
  await ctx.runMutation(internal.seed.promote, { userId: user._id, force, markVerified: true, revokeSessions: false });
}

type PrepareResult = {
  userId: Id<"users"> | null;
  /** The existing login's email was confirmed. */
  verified: boolean;
  /** Already an active super admin. */
  isSuperAdmin: boolean;
  otherActiveSuperAdmin: boolean;
};

async function activeSuperAdminIds(ctx: QueryCtx, superAdminRoleId: Id<"roles">) {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_roleId_and_status", (q) =>
      q.eq("roleId", superAdminRoleId).eq("status", "active"),
    )
    .take(2);
  return rows.map((u) => u._id);
}

/**
 * Sets up the built-in roles, finds the account for this email (same
 * lookup as sign-in), whether its email is verified, and whether another
 * active super admin exists.
 */
export const prepare = internalMutation({
  args: { email: v.string() },
  returns: v.object({
    userId: v.union(v.id("users"), v.null()),
    verified: v.boolean(),
    isSuperAdmin: v.boolean(),
    otherActiveSuperAdmin: v.boolean(),
  }),
  handler: async (ctx, { email }): Promise<PrepareResult> => {
    const roles = await ensureBuiltInRoles(ctx);
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    const userId = account?.userId ?? null;
    const user = userId ? await ctx.db.get("users", userId) : null;
    // A suspended super admin isn't "already done": it needs promoteExisting.
    const isSuperAdmin = user?.roleId === roles.super_admin && user.status !== "suspended";
    const others = (await activeSuperAdminIds(ctx, roles.super_admin)).filter((id) => id !== userId);
    return {
      userId,
      verified: account !== null && !isUnverifiedLogin(account),
      isSuperAdmin,
      otherActiveSuperAdmin: others.length > 0,
    };
  },
});

/**
 * If public sign-up is closed (admin settings), leaves a one-time,
 * short-lived permission for this email, used up by `setUpNewAccount`.
 */
export const allowSignup = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    if ((await readSettings(ctx)).signupEnabled) return null;
    await ctx.db.insert("signupBypasses", { email, expiresAt: Date.now() + SIGNUP_BYPASS_MS });
    return null;
  },
});

/**
 * Deletes the unverified account using `email` (`replaceUnverified`), after
 * checking it's still that account and still unverified and unused
 * (`deleteUnverifiedAccount`). Logged.
 */
export const replaceUnverified = internalMutation({
  args: { userId: v.id("users"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, email }) => {
    const account = await passwordAccountOf(ctx, userId);
    if (account?.providerAccountId !== email) fail("NOT_FOUND");
    const user = await deleteUnverifiedAccount(ctx, userId);
    await logAdminAction(ctx, {
      actor: null,
      action: "superAdmin.replaceUnverified",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email ?? email,
    });
    return null;
  },
});

/**
 * Makes the user an active super admin, in one transaction:
 * - the "another super admin exists" check (two runs at once can't both
 *   get through; a suspended super admin doesn't count, recovery path);
 * - the login must be verified, unless `markVerified` (only for the account
 *   `superAdmin` has just created), which marks it verified;
 * - `revokeSessions` signs the account out everywhere (password reset).
 */
export const promote = internalMutation({
  args: { userId: v.id("users"), force: v.boolean(), markVerified: v.boolean(), revokeSessions: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, force, markVerified } = args;
    const roles = await ensureBuiltInRoles(ctx);
    const user = await ctx.db.get("users", userId);
    if (!user) fail("NOT_FOUND");
    const account = await passwordAccountOf(ctx, userId);
    if (!markVerified && (account === null || isUnverifiedLogin(account))) {
      fail("SEED_UNVERIFIED_ACCOUNT", "The account's email is not verified: it is never promoted.");
    }

    const alreadyActive = user.roleId === roles.super_admin && user.status !== "suspended";
    const others = (await activeSuperAdminIds(ctx, roles.super_admin)).filter((id) => id !== userId);
    if (!alreadyActive && others.length > 0 && !force) fail("SUPER_ADMIN_EXISTS");

    await ctx.db.patch("users", userId, {
      roleId: roles.super_admin,
      status: "active",
      ...(markVerified && user.emailVerificationTime === undefined ? { emailVerificationTime: Date.now() } : {}),
    });
    if (markVerified && account && account.emailVerified === undefined) {
      await ctx.db.patch("authAccounts", account._id, { emailVerified: account.providerAccountId });
    }
    if (args.revokeSessions) await revokeSessions(ctx, userId);
    await logAdminAction(ctx, {
      actor: null,
      action: "superAdmin.seed",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email ?? "",
      details: { force, newAccount: markVerified, passwordReset: args.revokeSessions },
    });
    return null;
  },
});
