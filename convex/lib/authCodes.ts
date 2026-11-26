import { CODE_LENGTH } from "./changeRequests";

/**
 * Email verification and password reset codes (CLAUDE.md "Auth codes").
 * Pure rules shared by the server (convex/auth.ts, convex/emails/authCode.ts)
 * and the auth screens.
 *
 * Codes are stored, expired and used up by Convex Auth itself
 * (`authVerificationCodes`, one per account, hashed, deleted when used).
 */

export { CODE_LENGTH as AUTH_CODE_LENGTH };

/** A code works for 15 minutes. */
export const AUTH_CODE_TTL_S = 15 * 60;

export const AUTH_CODE_TTL_MINUTES = AUTH_CODE_TTL_S / 60;

/**
 * Wrong codes per email before every attempt fails (Convex Auth's sign-in
 * bucket, refilled over an hour). Shared with wrong passwords.
 */
export const AUTH_MAX_FAILED_PER_HOUR = 5;

/** The screens wait this long before offering "Resend code". */
export const RESEND_COOLDOWN_S = 60;

/**
 * A reset request takes at least this long, whether the account exists
 * or not, so the response time doesn't tell either.
 */
export const RESET_MIN_RESPONSE_MS = 1200;

export type AuthCodeKind = "verify" | "reset";

/** Convex Auth provider ids of the two code senders. */
export const AUTH_CODE_PROVIDER_IDS: Record<AuthCodeKind, string> = {
  verify: "password-verify",
  reset: "password-reset",
};

/** True for a complete code: exactly `CODE_LENGTH` digits. */
export function isCodeShape(value: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value);
}
