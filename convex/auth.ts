import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password],
});
