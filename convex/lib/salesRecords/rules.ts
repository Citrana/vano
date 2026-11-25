import type { CountryCode } from "libphonenumber-js";
import { priceProblem } from "../money";
import { normalizeWhatsapp } from "../phone";

/**
 * Rules for recorded sales (CLAUDE.md "Sales tracking"), pure: the record
 * dialog's Zod schema and `convex/salesRecords.ts` both call them.
 */

export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 999;
export const CUSTOMER_NAME_MAX = 60;
/** How far back a sale can be dated. */
export const SOLD_AT_MAX_AGE_DAYS = 730;
/** A little clock drift between the browser and the server is fine. */
export const SOLD_AT_FUTURE_SLACK_MS = 5 * 60_000;
/** Most rows the Sales page loads for one filter (`truncated` beyond). */
export const LIST_MAX = 1000;
/** Rows in a product's "Sales & history" card. */
export const HISTORY_MAX = 10;

const DAY_MS = 86_400_000;

export function quantityProblem(quantity: number): "range" | null {
  return Number.isInteger(quantity) && quantity >= QUANTITY_MIN && quantity <= QUANTITY_MAX ? null : "range";
}

/** The price per item the customer paid (negotiated prices welcome, above or below normal). */
export function finalPriceProblem(minor: number): "notInteger" | "notPositive" | "tooHigh" | null {
  return priceProblem(minor);
}

export function soldAtProblem(soldAt: number, now: number): "future" | "tooOld" | null {
  if (!Number.isFinite(soldAt) || soldAt > now + SOLD_AT_FUTURE_SLACK_MS) return "future";
  if (soldAt < now - SOLD_AT_MAX_AGE_DAYS * DAY_MS) return "tooOld";
  return null;
}

/**
 * A size / colour is required when the product has some, and must be one
 * of them; none may be given when it has none. Matches case-insensitively
 * and returns the product's own spelling.
 */
export function cleanOption(
  value: string | undefined,
  options: readonly string[],
): { ok: true; value: string | undefined } | { ok: false; problem: "required" | "unknown" } {
  const text = value?.trim() ?? "";
  if (options.length === 0) return text === "" ? { ok: true, value: undefined } : { ok: false, problem: "unknown" };
  if (text === "") return { ok: false, problem: "required" };
  const found = options.find((o) => o.toLowerCase() === text.toLowerCase());
  return found ? { ok: true, value: found } : { ok: false, problem: "unknown" };
}

export function customerNameProblem(name: string | undefined): "tooLong" | null {
  return (name?.trim().length ?? 0) > CUSTOMER_NAME_MAX ? "tooLong" : null;
}

/** "" / undefined → undefined; else E.164 or null (invalid). */
export function cleanCustomerPhone(phone: string | undefined, country: string): string | undefined | null {
  const text = phone?.trim() ?? "";
  if (text === "") return undefined;
  return normalizeWhatsapp(text, country as CountryCode);
}
