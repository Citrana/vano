/**
 * Limits for discount codes (CLAUDE.md "Discount codes"). Pure. Dates
 * follow the sale rules (`saleScheduleProblem`: event banner limits plus
 * an end in the future), entered in the seller's time zone and stored as
 * UTC ms.
 */

export { saleScheduleProblem as codeScheduleProblem } from "../sales/rules";

/** Saved codes per shop (running, scheduled, paused, used up and ended). */
export const CODES_MAX = 100;
/** Highest "maximum uses" a seller can set. */
export const MAX_USES_LIMIT = 100_000;

/**
 * The optional maximum number of uses: a whole number from 1, and never
 * below the uses already counted.
 */
export function maxUsesProblem(maxUses: number | undefined, uses = 0): "range" | "belowUses" | null {
  if (maxUses === undefined) return null;
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > MAX_USES_LIMIT) return "range";
  return maxUses < uses ? "belowUses" : null;
}

/** A visitor id sent by the browser: random, never personal. */
const VISITOR_RE = /^[A-Za-z0-9_-]{8,64}$/;
export function cleanVisitorId(visitorId: string): string {
  return VISITOR_RE.test(visitorId) ? visitorId : "anonymous";
}
