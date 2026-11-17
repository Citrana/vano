import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { assertCanStartSession, assignSellerRoleIfMissing } from "./lib/accounts";
import { LIMITS } from "./lib/catalog";

const password = Password({
  // Public self-serve sign-up is enabled for sellers.
  profile(params) {
    const email = String(params.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError({ code: "EMAIL_INVALID" });
    }
    return { email };
  },
  validatePasswordRequirements(value) {
    if (value.length < LIMITS.passwordMin) {
      throw new ConvexError({ code: "PASSWORD_TOO_SHORT" });
    }
  },
});

/**
 * Convex Auth types its callbacks' ctx against a generic data model; it is
 * our deployment's mutation ctx at runtime, so it's narrowed once here.
 */
const ourCtx = (ctx: unknown) => ctx as MutationCtx;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password],
  callbacks: {
    // Every new account is an active seller (CLAUDE.md "Roles & permissions").
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      await assignSellerRoleIfMissing(ourCtx(ctx), userId);
    },
    // Runs on every sign-in / sign-up: suspended users can't log in.
    async beforeSessionCreation(ctx, { userId }) {
      await assertCanStartSession(ourCtx(ctx), userId);
    },
  },
});
