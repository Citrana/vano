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
});
