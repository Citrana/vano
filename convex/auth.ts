import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError, type Value } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { authCodeProvider, consumeAuthCodeSend } from "./emails/authCode";
import { assertCanStartSession, setUpNewAccount } from "./lib/accounts";
import { AUTH_MAX_FAILED_PER_HOUR } from "./lib/authCodes";
import { guardPasswordFlows } from "./lib/authFlows";
import { LANGUAGES, type Language } from "./lib/catalog";
import { normalizeEmail, passwordProblem } from "./lib/credentials";

/** The screen language sent with a sign-up, if it's one we support. */
function languageParam(value: unknown): Language | undefined {
  return (LANGUAGES as readonly unknown[]).includes(value) ? (value as Language) : undefined;
}

/**
 * Email + password, with a 6-digit email code to confirm the address after
 * sign-up (`verify`) and to choose a new password (`reset`)
 * (CLAUDE.md "Auth codes"). Public self-serve sign-up is enabled for sellers.
 */
const password = guardPasswordFlows(
  Password({
    profile(params) {
      const email = normalizeEmail(params.email);
      if (email === null) throw new ConvexError({ code: "EMAIL_INVALID" });
      // Only stored when the account is created.
      const language = languageParam(params.language);
      const profile: { email: string; language?: Language } = { email };
      if (language) profile.language = language;
      return profile as { email: string } & Record<string, Value>;
    },
    validatePasswordRequirements(value) {
      if (passwordProblem(value) !== null) {
        throw new ConvexError({ code: "PASSWORD_TOO_SHORT" });
      }
    },
    verify: authCodeProvider("verify"),
    reset: authCodeProvider("reset"),
  }),
  { consumeResetSend: consumeAuthCodeSend },
);

/**
 * Convex Auth types its callbacks' ctx against a generic data model; it is
 * our deployment's mutation ctx at runtime, so it's narrowed once here.
 */
const ourCtx = (ctx: unknown) => ctx as MutationCtx;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password],
  // Wrong codes (and wrong passwords) per email before every attempt fails;
  // the bucket refills over an hour.
  signIn: { maxFailedAttempsPerHour: AUTH_MAX_FAILED_PER_HOUR },
  callbacks: {
    // Every new account is an active seller (CLAUDE.md "Roles & permissions")
    // and is counted in the platform stats.
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      await setUpNewAccount(ourCtx(ctx), userId);
    },
    // Runs on every sign-in / sign-up: suspended users can't log in.
    async beforeSessionCreation(ctx, { userId }) {
      await assertCanStartSession(ourCtx(ctx), userId);
    },
  },
});
