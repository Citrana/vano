import { v, type Infer } from "convex/values";

/**
 * Money helpers (CLAUDE.md "Money"): amounts are integer minor units
 * (×100 for every currency) plus a currency. Shared by the server and UI.
 */

export const CURRENCIES = ["USD", "CDF", "KES", "EUR"] as const;

export const currencyValidator = v.union(
  v.literal("USD"),
  v.literal("CDF"),
  v.literal("KES"),
  v.literal("EUR"),
);
export type Currency = Infer<typeof currencyValidator>;

/** Highest accepted price, in minor units (1 billion major units). */
export const MAX_PRICE_MINOR = 100_000_000_000;

/**
 * "12", "12.5", "12.50", "1,234.56", "1 234,5" → minor units. A comma is a
 * decimal separator only when it is followed by 1–2 digits at the end and
 * there is no dot. Returns null for anything else (negative, more than 2
 * decimals, not a number).
 */
export function parseMoneyToMinor(input: string): number | null {
  let cleaned = input.trim().replace(/\s/g, "");
  if (!cleaned.includes(".") && /,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/,(\d{1,2})$/, ".$1");
  }
  cleaned = cleaned.replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units → "12.50" for editing (no symbol, no grouping). */
export function minorToInput(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const cents = abs % 100;
  const whole = Math.floor(abs / 100);
  return cents === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(cents).padStart(2, "0")}`;
}

/**
 * Minor units → "$12.50" / "12,50 $US" / "CDF 25,000". Whole amounts show
 * no decimals ("$25", "25 000 FC"), which reads better on a shop page.
 */
export function formatMoney(minor: number, currency: Currency, locale: string): string {
  const digits = minor % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 100);
}

/** "notInteger" | "notPositive" | "tooHigh" | null. */
export function priceProblem(minor: number): "notInteger" | "notPositive" | "tooHigh" | null {
  if (!Number.isSafeInteger(minor)) return "notInteger";
  if (minor <= 0) return "notPositive";
  if (minor > MAX_PRICE_MINOR) return "tooHigh";
  return null;
}

/**
 * A product's cost price (what the seller paid; private, CLAUDE.md
 * "Sales tracking"): a whole number of minor units, 0 or more (a gift or
 * donated piece costs nothing; above the price = sold at a loss).
 */
export function costPriceProblem(minor: number): "notInteger" | "tooHigh" | null {
  if (!Number.isSafeInteger(minor) || minor < 0) return "notInteger";
  if (minor > MAX_PRICE_MINOR) return "tooHigh";
  return null;
}

/**
 * Rounding steps for computed prices (sale percent off), in minor units,
 * largest first: 100 FC for CDF, whole shillings for KES, cents for USD /
 * EUR. A step is used only when it is at most 5% of the price, so a cheap
 * item is never rounded into a much bigger discount (150 FC stays exact
 * to the franc).
 */
export const ROUNDING_STEPS_MINOR: Record<Currency, readonly number[]> = {
  USD: [1],
  EUR: [1],
  KES: [100, 1],
  CDF: [10_000, 1_000, 100, 1],
};

/**
 * Rounds a computed price to the currency's step (nearest). Returns
 * `minor` unchanged when rounding would reach zero or `ceiling` (a sale
 * price must stay above zero and below the normal price).
 */
export function roundPrice(minor: number, currency: Currency, ceiling: number): number {
  const step = ROUNDING_STEPS_MINOR[currency].find((s) => s * 20 <= ceiling) ?? 1;
  const rounded = Math.round(minor / step) * step;
  return rounded > 0 && rounded < ceiling ? rounded : minor;
}
