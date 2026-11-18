import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * App rate limits (the component rolls back with the mutation and is safe
 * under concurrency, unlike a hand-rolled counter).
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  /** Per shop: one code a minute, at most five an hour. */
  phoneCodeBurst: { kind: "fixed window", rate: 1, period: MINUTE },
  phoneCodeHourly: { kind: "fixed window", rate: 5, period: HOUR },
});
