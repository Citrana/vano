import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, type QueryCtx } from "./_generated/server";
import { logAdminAction } from "./lib/audit";
import { normalizeEmail, passwordProblem } from "./lib/credentials";
import { fail } from "./lib/errors";
import { SIGNUP_BYPASS_MS } from "./lib/accounts";
import { ensureBuiltInRoles } from "./lib/roles";
import { readSettings } from "./lib/settings";

/**
 * Creates the first super admin from the terminal (README "First super
 * admin"):
 *
 *   npx convex run seed:superAdmin '{"email":"you@example.com","password":"..."}'
 *
 * Internal, so only the CLI / dashboard can run it — never the browser.
 * Safe to run twice; refuses to add another super admin unless `force`.
 */
export const superAdmin = internalAction({
  args: { email: v.string(), password: v.string(), force: v.optional(v.boolean()) },
  returns: v.object({
    result: v.union(v.literal("created"), v.literal("promoted"), v.literal("already_super_admin")),
    email: v.string(),
  }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (email === null) fail("EMAIL_INVALID");
    if (passwordProblem(args.password) !== null) fail("PASSWORD_TOO_SHORT");

    const existing: PrepareResult = await ctx.runMutation(internal.seed.prepare, { email });
    if (existing.isSuperAdmin) return { result: "already_super_admin" as const, email };
    // Checked before creating anything, so a refused run leaves no account
    // behind. `promote` checks again atomically.
    if (existing.otherActiveSuperAdmin && !args.force) fail("SUPER_ADMIN_EXISTS");

    let userId = existing.userId;
    if (userId === null) {
      // Only now, after every check passed: if public sign-up is closed,
      // allow exactly this account (one-time, short-lived).
      await ctx.runMutation(internal.seed.allowSignup, { email });
      // Same path as sign-up: the Password provider hashes the secret and
      // the auth callback makes the new user an active seller first.
      // `promote` then marks the address verified (no sign-up code).
      const { user } = await createAccount(ctx, {
        provider: "password",
        account: { id: email, secret: args.password },
        profile: { email },
      });
      userId = user._id;
    }

    await ctx.runMutation(internal.seed.promote, { userId, force: args.force ?? false });
    return { result: existing.userId === null ? ("created" as const) : ("promoted" as const), email };
  },
});

type PrepareResult = {
  userId: Id<"users"> | null;
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
 * lookup as sign-in) and reports whether another active super admin exists.
 */
export const prepare = internalMutation({
  args: { email: v.string() },
  returns: v.object({
    userId: v.union(v.id("users"), v.null()),
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
    // A suspended super admin isn't "already done": re-running reactivates them.
    const isSuperAdmin = user?.roleId === roles.super_admin && user.status !== "suspended";
    const others = (await activeSuperAdminIds(ctx, roles.super_admin)).filter((id) => id !== userId);
    return { userId, isSuperAdmin, otherActiveSuperAdmin: others.length > 0 };
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
 * Makes the user an active super admin. The "another super admin exists"
 * check happens here, in one transaction, so two runs at once can't both
 * get through. A suspended super admin doesn't count (recovery path).
 */
export const promote = internalMutation({
  args: { userId: v.id("users"), force: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { userId, force }) => {
    const roles = await ensureBuiltInRoles(ctx);
    const user = await ctx.db.get("users", userId);
    if (!user) fail("NOT_FOUND");

    const others = (await activeSuperAdminIds(ctx, roles.super_admin)).filter((id) => id !== userId);
    if (others.length > 0 && !force) fail("SUPER_ADMIN_EXISTS");

    await ctx.db.patch("users", userId, {
      roleId: roles.super_admin,
      status: "active",
      // Seeded admins count as verified: no sign-up code (CLAUDE.md "Auth codes").
      emailVerificationTime: user.emailVerificationTime ?? Date.now(),
    });
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "password"))
      .unique();
    if (account && account.emailVerified === undefined) {
      await ctx.db.patch("authAccounts", account._id, { emailVerified: account.providerAccountId });
    }
    await logAdminAction(ctx, {
      actor: null,
      action: "superAdmin.seed",
      targetType: "user",
      targetId: userId,
      targetLabel: user.email ?? "",
      details: { force },
    });
    return null;
  },
});
