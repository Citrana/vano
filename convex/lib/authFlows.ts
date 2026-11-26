import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import { RESET_MIN_RESPONSE_MS } from "./authCodes";
import { normalizeEmail } from "./credentials";
import { fail } from "./errors";

/**
 * Tightens Convex Auth's Password flows (CLAUDE.md "Auth codes") without
 * re-implementing them:
 *
 * - `reset` never reveals whether an email has an account: the send limit
 *   is taken for every address, a missing account answers exactly like a
 *   real one (no session, `{ tokens: null }`), and both take at least
 *   `RESET_MIN_RESPONSE_MS`.
 * - `email-verification` must carry a code. Without one, Convex Auth would
 *   email a code to any account with no password asked; a new code is
 *   asked for by signing in again (the account is still unverified).
 *
 * Every other flow goes to Convex Auth unchanged.
 */

type Authorize = ConvexCredentialsConfig["authorize"];
type AuthorizeCtx = Parameters<Authorize>[1];

export type FlowGuardDeps = {
  /** Takes one code email from the address's budget; throws when it's empty. */
  consumeResetSend: (ctx: AuthorizeCtx, email: string) => Promise<void>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Convex Auth reports an unknown email with this message (retrieveAccount). */
export function isMissingAccountError(error: unknown): boolean {
  return error instanceof Error && /InvalidAccountId/.test(error.message);
}

export function guardAuthorize(base: Authorize, deps: FlowGuardDeps): Authorize {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  return async (params, ctx) => {
    if (params.flow === "email-verification" && (typeof params.code !== "string" || params.code === "")) {
      fail("CODE_INVALID");
    }
    if (params.flow !== "reset") return await base(params, ctx);

    const email = normalizeEmail(params.email);
    if (email === null) fail("EMAIL_INVALID");
    await deps.consumeResetSend(ctx, email);
    const startedAt = now();
    try {
      return await base({ ...params, email }, ctx);
    } catch (error) {
      if (isMissingAccountError(error)) return null;
      throw error;
    } finally {
      const left = RESET_MIN_RESPONSE_MS - (now() - startedAt);
      if (left > 0) await sleep(left);
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
