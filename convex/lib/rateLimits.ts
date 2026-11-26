import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import { AUTH_MAX_FAILED_PER_HOUR } from "./authCodes";

/**
 * App rate limits (the component rolls back with the mutation and is safe
 * under concurrency, unlike a hand-rolled counter).
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  /**
   * Per shop: one code a minute, about five an hour. Token buckets refill
   * from each send (no window boundary a quick burst could straddle).
   */
  phoneCodeBurst: { kind: "token bucket", rate: 1, period: MINUTE, capacity: 1 },
  phoneCodeHourly: { kind: "token bucket", rate: 5, period: HOUR, capacity: 5 },
  /**
   * Wrong discount code attempts (CLAUDE.md "Discount codes"), against
   * guessing: per visitor of a shop (a burst of 5, then 10 an hour) and per
   * shop (a burst of 30, then 100 an hour, so rotating visitor ids doesn't
   * help). Valid codes never count.
   */
  discountCodeVisitor: { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  discountCodeShop: { kind: "token bucket", rate: 100, period: HOUR, capacity: 30 },
  /** Admin "Send test email" (CLAUDE.md "Emails"), per admin: a burst of 3, then 10 an hour. */
  testEmail: { kind: "token bucket", rate: 10, period: HOUR, capacity: 3 },
  /**
   * Sign-up / reset code emails (CLAUDE.md "Auth codes"), per email
   * address: the first code plus one quick resend, then one a minute, and
   * at most six an hour. Reset requests count for every address, existing
   * or not, so the limit never tells whether an account exists.
   */
  authCodeBurst: { kind: "token bucket", rate: 1, period: MINUTE, capacity: 2 },
  authCodeHourly: { kind: "token bucket", rate: 6, period: HOUR, capacity: 6 },
  /**
   * Wrong answers to the reset code check (`authCodes.checkResetCode`), per
   * email, against guessing: the same budget as Convex Auth's own.
   */
  /**
   * Team invites created or renewed (CLAUDE.md "Team accounts"), per shop:
   * a burst of 10, then 30 an hour (each may send an email).
   */
  teamInvite: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  resetCodeCheck: { kind: "token bucket", rate: AUTH_MAX_FAILED_PER_HOUR, period: HOUR, capacity: AUTH_MAX_FAILED_PER_HOUR },
});
