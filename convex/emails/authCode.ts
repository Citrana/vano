import { Email } from "@convex-dev/auth/providers/Email";
import type { EmailConfig } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type ActionCtx } from "../_generated/server";
import {
  AUTH_CODE_PROVIDER_IDS,
  AUTH_CODE_TTL_MINUTES,
  AUTH_CODE_TTL_S,
  type AuthCodeKind,
} from "../lib/authCodes";
import { languageValidator, type Language } from "../lib/catalog";
import { normalizeEmail } from "../lib/credentials";
import { fail } from "../lib/errors";
import { rateLimiter } from "../lib/rateLimits";
import { newCode } from "../verification/codes";
import { sendEmailNow } from "./send";
import { authCodeEmail } from "./templates/authCode";

/**
 * The two Convex Auth code senders behind `Password({ verify, reset })`
 * (CLAUDE.md "Auth codes"). Convex Auth stores, expires and uses up the
 * code; this file only picks the language, applies the send limits and
 * emails it.
 *
 * The email goes out while the person waits (`sendEmailNow`), so a failed
 * send reaches the screen as `EMAIL_SEND_FAILED` and they can retry.
 */

/**
 * The account's language: the one chosen at sign-up, else its shop's,
 * else English.
 */
export const languageFor = internalQuery({
  args: { email: v.string() },
  returns: languageValidator,
  handler: async (ctx, { email }): Promise<Language> => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) return "en";
    if (user.language) return user.language;
    const shop = await ctx.db
      .query("shops")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();
    return shop?.language ?? "en";
  },
});

/**
 * Takes one code email from the address's budget (`authCodeBurst` /
 * `authCodeHourly`); throws `CODE_RATE_LIMITED` (and rolls back) when
 * either bucket is empty.
 */
export const consumeSend = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    for (const name of ["authCodeBurst", "authCodeHourly"] as const) {
      const { ok } = await rateLimiter.limit(ctx, name, { key: email });
      if (!ok) fail("CODE_RATE_LIMITED");
    }
    return null;
  },
});

/** Called from actions (Convex Auth's sign-in, `guardPasswordFlows`). */
export async function consumeAuthCodeSend(ctx: Pick<ActionCtx, "runMutation">, email: string): Promise<void> {
  await ctx.runMutation(internal.emails.authCode.consumeSend, { email: normalizeEmail(email) ?? email });
}

/** Builds and sends one code email, or throws `EMAIL_SEND_FAILED`. */
export async function sendAuthCode(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  kind: AuthCodeKind,
  rawEmail: string,
  code: string,
): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (email === null) fail("EMAIL_INVALID");
  // Reset requests are counted earlier, for every address
  // (`guardPasswordFlows`), so the limit can't reveal an account.
  if (kind === "verify") await consumeAuthCodeSend(ctx, email);
  const language = await ctx.runQuery(internal.emails.authCode.languageFor, { email });
  const sent = await sendEmailNow(ctx as ActionCtx, {
    to: email,
    ...authCodeEmail(language, { kind, code, minutes: AUTH_CODE_TTL_MINUTES }),
  });
  if (!sent.ok) fail("EMAIL_SEND_FAILED");
}

/**
 * A Convex Auth email provider sending 6-digit codes. Its `authorize`
 * (from `Email`) refuses a code entered with another email address.
 */
export function authCodeProvider(kind: AuthCodeKind): EmailConfig {
  // Convex Auth passes its action ctx as a second argument, which
  // Auth.js's type doesn't declare.
  const send = (params: { identifier: string; token: string }, ctx: ActionCtx) =>
    sendAuthCode(ctx, kind, params.identifier, params.token);
  return Email({
    id: AUTH_CODE_PROVIDER_IDS[kind],
    maxAge: AUTH_CODE_TTL_S,
    generateVerificationToken: async () => newCode(),
    sendVerificationRequest: send as unknown as EmailConfig["sendVerificationRequest"],
  });
}
