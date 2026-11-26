import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

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
});
