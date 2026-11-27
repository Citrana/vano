import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { isUnverifiedLogin, signupAllowed } from "./lib/accounts";
import { fail } from "./lib/errors";
import { rateLimiter } from "./lib/rateLimits";

/**
 * What the sign-up guard (`guardPasswordFlows`, lib/authFlows.ts) needs to
 * answer a registered email exactly like a new one (CLAUDE.md "Auth
 * codes"). Internal only: called from Convex Auth's sign-in action.
 */

/**
 * Whether sign-up is allowed for this email (open, a valid invite or the
 * seed's permission: `signupAllowed`) and whether an account already uses
 * it. `now` comes from the action (queries don't read the clock).
 */
export const signupState = internalQuery({
  args: { email: v.string(), invite: v.optional(v.string()), now: v.number() },
  returns: v.object({
    allowed: v.boolean(),
    account: v.union(v.null(), v.object({ verified: v.boolean() })),
  }),
  handler: async (ctx, { email, invite, now }) => {
    const { allowed } = await signupAllowed(ctx, email, invite, now);
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", email))
      .unique();
    return { allowed, account: account ? { verified: !isUnverifiedLogin(account) } : null };
  },
});

/**
 * Takes one sign-up attempt from the address's budget (`signupAttempt`),
 * before anything is looked up, so new and registered emails are limited
 * alike. Throws CODE_RATE_LIMITED (and rolls back) when it's empty: the
 * screen treats it like a code that couldn't be sent yet.
 */
export const consumeAttempt = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    const { ok } = await rateLimiter.limit(ctx, "signupAttempt", { key: email });
    if (!ok) fail("CODE_RATE_LIMITED");
    return null;
  },
});
