import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import { RESET_MIN_RESPONSE_MS, SIGNIN_FAILURE_MIN_MS, SIGNUP_MIN_RESPONSE_MS } from "./authCodes";
import { normalizeEmail, passwordProblem } from "./credentials";
import { fail } from "./errors";
import { isInviteToken } from "./team";

/**
 * Tightens Convex Auth's Password flows (CLAUDE.md "Auth codes") without
 * re-implementing them. None of them ever reveals whether an email has an
 * account:
 *
 * - `signUp`: an email that already has an account gets exactly the answer
 *   of a new one (no session, "check your email"), padded to the same
 *   minimum time; its owner gets a "you already have an account" email
 *   instead of a code. Signing up again on your own pending (unverified)
 *   account is a resend: a new code. Every attempt uses the address's
 *   `signupAttempt` budget first, and closed sign-up is refused before
 *   anything is looked up.
 * - `email-verification` must carry a code (without one Convex Auth would
 *   email a code to any account, no password asked). A wrong code and an
 *   email with no account both read CODE_INVALID.
 * - `signIn`: a wrong password, an unknown email and a locked account all
 *   read INVALID_CREDENTIALS, and failures take at least
 *   `SIGNIN_FAILURE_MIN_MS` (no password check is faster).
 * - `reset`: the send limit is taken for every address, a missing account
 *   answers like a real one, and both take at least `RESET_MIN_RESPONSE_MS`.
 */

type Authorize = ConvexCredentialsConfig["authorize"];
type AuthorizeCtx = Parameters<Authorize>[1];

/** What the sign-up guard asks the deployment (convex/auth.ts wires the real ones). */
export type SignupDeps = {
  /** Takes one attempt from the address's `signupAttempt` budget; throws CODE_RATE_LIMITED. */
  consumeAttempt: (ctx: AuthorizeCtx, email: string) => Promise<void>;
  /** Whether sign-up is allowed for this email (open / invite / seed) and its existing account, if any. */
  state: (
    ctx: AuthorizeCtx,
    email: string,
    invite: string | undefined,
  ) => Promise<{ allowed: boolean; account: null | { verified: boolean } }>;
  /** True when the password opens this (unverified) account. */
  passwordMatches: (ctx: AuthorizeCtx, email: string, password: string) => Promise<boolean>;
  /** Emails the owner "you already have an account" (same budget and errors as a code email). */
  sendAccountExists: (ctx: AuthorizeCtx, email: string) => Promise<void>;
};

export type FlowGuardDeps = {
  /** Takes one code email from the address's budget; throws when it's empty. */
  consumeResetSend: (ctx: AuthorizeCtx, email: string) => Promise<void>;
  signup: SignupDeps;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Convex Auth reports an unknown email with this message (retrieveAccount). */
export function isMissingAccountError(error: unknown): boolean {
  return error instanceof Error && /InvalidAccountId/.test(error.message);
}

/** Convex Auth's sign-in failures: wrong password, unknown email, too many tries. */
export function isCredentialsError(error: unknown): boolean {
  return error instanceof Error && /InvalidSecret|InvalidAccountId|TooManyFailedAttempts|Invalid credentials/.test(error.message);
}

/** Convex Auth's answer to a wrong, expired, used or rate-limited code. */
function isCodeError(error: unknown): boolean {
  return error instanceof Error && /Could not verify code|Invalid code/.test(error.message);
}

/** `createAccount` found the email taken (a sign-up racing another). */
function isAccountExistsError(error: unknown): boolean {
  return error instanceof Error && /already exists/.test(error.message);
}

export function guardAuthorize(base: Authorize, deps: FlowGuardDeps): Authorize {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;

  /** Waits until `ms` have passed since `startedAt`. */
  async function padFrom(startedAt: number, ms: number) {
    const left = ms - (now() - startedAt);
    if (left > 0) await sleep(left);
  }

  /** Runs `fn`, taking at least `ms` whatever happens. */
  async function atLeast<R>(ms: number, fn: () => Promise<R>): Promise<R> {
    const startedAt = now();
    try {
      return await fn();
    } finally {
      await padFrom(startedAt, ms);
    }
  }

  async function signUp(params: Parameters<Authorize>[0], ctx: AuthorizeCtx) {
    const email = normalizeEmail(params.email);
    if (email === null) fail("EMAIL_INVALID");
    const password = typeof params.password === "string" ? params.password : "";
    if (passwordProblem(password) !== null) fail("PASSWORD_TOO_SHORT");
    await deps.signup.consumeAttempt(ctx, email);
    const invite = typeof params.invite === "string" && isInviteToken(params.invite) ? params.invite : undefined;

    return await atLeast(SIGNUP_MIN_RESPONSE_MS, async () => {
      const { allowed, account } = await deps.signup.state(ctx, email, invite);
      if (!allowed) fail("SIGNUP_DISABLED");
      if (account === null) {
        try {
          return await base({ ...params, email }, ctx);
        } catch (error) {
          if (!isAccountExistsError(error)) throw error;
          // Created meanwhile by another sign-up: same answer as below.
        }
      } else if (!account.verified && (await deps.signup.passwordMatches(ctx, email, password))) {
        // Their own pending account: a resend (Convex Auth emails a new code).
        return await base({ ...params, email, flow: "signIn" }, ctx);
      }
      await deps.signup.sendAccountExists(ctx, email);
      return null;
    });
  }

  return async (params, ctx) => {
    switch (params.flow) {
      case "signUp":
        return await signUp(params, ctx);

      case "email-verification": {
        if (typeof params.code !== "string" || params.code === "") fail("CODE_INVALID");
        const startedAt = now();
        try {
          return await base(params, ctx);
        } catch (error) {
          if (!isCodeError(error) && !isMissingAccountError(error)) throw error;
          await padFrom(startedAt, SIGNIN_FAILURE_MIN_MS);
          fail("CODE_INVALID");
        }
      }

      case "signIn": {
        const startedAt = now();
        try {
          return await base(params, ctx);
        } catch (error) {
          await padFrom(startedAt, SIGNIN_FAILURE_MIN_MS);
          if (isCredentialsError(error)) fail("INVALID_CREDENTIALS");
          throw error;
        }
      }

      case "reset": {
        const email = normalizeEmail(params.email);
        if (email === null) fail("EMAIL_INVALID");
        await deps.consumeResetSend(ctx, email);
        return await atLeast(RESET_MIN_RESPONSE_MS, async () => {
          try {
            return await base({ ...params, email }, ctx);
          } catch (error) {
            if (isMissingAccountError(error)) return null;
            throw error;
          }
        });
      }

      default:
        return await base(params, ctx);
    }
  };
}

/**
 * Wraps the provider built by `Password(...)`. Convex Auth merges a
 * provider's `options` over it when it loads its config, and `Password`
 * keeps its `authorize` there, so that's the one replaced.
 */
export function guardPasswordFlows(provider: ConvexCredentialsConfig, deps: FlowGuardDeps): ConvexCredentialsConfig {
  const { options } = provider as unknown as { options: { authorize: Authorize } };
  return {
    ...provider,
    options: { ...options, authorize: guardAuthorize(options.authorize, deps) },
  } as ConvexCredentialsConfig;
}
