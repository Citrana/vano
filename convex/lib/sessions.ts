import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Signs a user out everywhere: every Convex Auth session and its refresh
 * tokens (an admin suspending them, the seed resetting their password).
 */
export async function revokeSessions(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  for await (const session of ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))) {
    for await (const token of ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))) {
      await ctx.db.delete("authRefreshTokens", token._id);
    }
    await ctx.db.delete("authSessions", session._id);
  }
}
