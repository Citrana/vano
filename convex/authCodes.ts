import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { isCodeShape, resetCodeValid } from "./lib/authCodes";
import { normalizeEmail } from "./lib/credentials";
import { rateLimiter } from "./lib/rateLimits";
import { sha256Hex } from "./verification/codes";

/**
 * Checks a password reset code before the screen asks for the new password
 * (CLAUDE.md "Auth codes"). Read-only: the code stays valid, and
 * `reset-verification` (Convex Auth) checks and uses it up when the
 * password is changed.
 *
 * Public, no session (the person forgot their password). It never says
 * whether an account exists: an unknown email has no code, so it gets the
 * same `invalid` as a wrong code. Wrong answers use up `resetCodeCheck`
 * per email; the result is returned, never thrown, so that count isn't
 * rolled back. Nothing but the status is returned.
 */
export const checkResetCode = mutation({
  args: { email: v.string(), code: v.string() },
  returns: v.object({ status: v.union(v.literal("ok"), v.literal("invalid"), v.literal("tooMany")) }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const code = args.code.trim();
    if (email === null || !isCodeShape(code)) return { status: "invalid" as const };

    const limit = await rateLimiter.check(ctx, "resetCodeCheck", { key: email });
    if (!limit.ok) return { status: "tooMany" as const };

    // Convex Auth stores each code as its hex SHA-256. Not `unique`: two
    // accounts can hold the same short code, and that must not break the check.
    const hash = await sha256Hex(code);
    const rows = await ctx.db
      .query("authVerificationCodes")
      .withIndex("code", (q) => q.eq("code", hash))
      .take(5);
    const now = Date.now();
    for (const row of rows) {
      const account = await ctx.db.get("authAccounts", row.accountId);
      if (resetCodeValid(row, account, email, now)) return { status: "ok" as const };
    }

    await rateLimiter.limit(ctx, "resetCodeCheck", { key: email });
    return { status: "invalid" as const };
  },
});
