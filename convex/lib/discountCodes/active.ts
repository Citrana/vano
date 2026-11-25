import type { Currency } from "../money";
import { promoLiveAt } from "../looks/schedule";
import { discountedPrice, percentOff } from "../sales/discount";
import { isPaused, saleAppliesTo, type AppliedSale, type ProductLike } from "../sales/active";
import type { SaleTarget } from "../sales/validators";
import type { CodeDiscount, CodeResult } from "./validators";

/**
 * When a discount code works and what it costs (CLAUDE.md "Discount
 * codes"). Pure. Queries never read the clock: whether a code is live is
 * stored on the row (`discountCodes.live`, kept by `discountCodeJobs.sync`
 * at its start and end and by every use); `codeLiveAt` is the rule that
 * flag follows. Trying a code runs in a mutation, at the real time.
 */

export type CodeLike = {
  _id: string;
  code: string;
  discount: CodeDiscount;
  target: SaleTarget;
  startsAt: number;
  endsAt: number;
  paused: boolean;
  /** Server rows: missing; client copies: null. */
  adminPause?: { at: number; reason: string } | null;
  /** Missing / null = no limit. */
  maxUses?: number | null;
  uses: number;
};

export function isUsedUp(code: Pick<CodeLike, "maxUses" | "uses">): boolean {
  return code.maxUses !== undefined && code.maxUses !== null && code.uses >= code.maxUses;
}

type LiveFields = Pick<CodeLike, "startsAt" | "endsAt" | "paused" | "adminPause" | "maxUses" | "uses">;

/** In its dates, not paused (seller or admin) and not used up. */
export function codeLiveAt(code: LiveFields, now: number): boolean {
  return !isPaused(code) && !isUsedUp(code) && promoLiveAt(code, now);
}

export type CodeStatus = "scheduled" | "running" | "paused" | "usedUp" | "ended";
export const CODE_STATUSES = ["running", "scheduled", "paused", "usedUp", "ended"] as const satisfies readonly CodeStatus[];

/** For lists and tags: ended, then used up, then paused, then by date. */
export function codeStatusAt(code: LiveFields, now: number): CodeStatus {
  if (now >= code.endsAt) return "ended";
  if (isUsedUp(code)) return "usedUp";
  if (isPaused(code)) return "paused";
  return now < code.startsAt ? "scheduled" : "running";
}

/** The product's price with this code, or null when it doesn't apply / lower it. */
export function priceWithCode(
  product: ProductLike,
  code: Pick<CodeLike, "discount" | "target">,
  currency: Currency,
): number | null {
  if (!saleAppliesTo(code.target, product)) return null;
  return discountedPrice(product.price, code.discount, currency);
}

/**
 * What a visitor gets when they enter `code` on `product` at `now`.
 * `sale` is the product's live sale (if any): the customer gets the best
 * price, never both, so a sale at or below the code price wins
 * (`saleBetter`). `alreadyUsed` = this visitor already used the code on
 * this product (counted once), so a code used up by them still works.
 */
export function evaluateCode(args: {
  code: CodeLike | null;
  product: ProductLike;
  sale: Pick<AppliedSale, "price"> | null;
  currency: Currency;
  now: number;
  alreadyUsed?: boolean;
}): CodeResult {
  const { code, product, sale, currency, now } = args;
  if (!code) return { status: "invalid" };
  if (now >= code.endsAt) return { status: "ended" };
  if (!args.alreadyUsed && isUsedUp(code)) return { status: "usedUp" };
  if (isPaused(code) || now < code.startsAt) return { status: "notActive" };
  const price = priceWithCode(product, code, currency);
  if (price === null) return { status: "notForProduct" };
  if (sale && sale.price <= price) return { status: "saleBetter" };
  return {
    status: "applied",
    code: code.code,
    price,
    original: product.price,
    percent: percentOff(product.price, price),
  };
}

/** Wrong guesses (counted by the rate limits); a valid code never is. */
export function isWrongAttempt(result: CodeResult): boolean {
  return result.status !== "applied" && result.status !== "saleBetter" && result.status !== "tooMany" && result.status !== "soldOut";
}

/** Whether the product page shows the "Have a discount code?" field. */
export function codeFieldFor(product: ProductLike, liveCodes: readonly Pick<CodeLike, "discount" | "target">[], currency: Currency): boolean {
  return liveCodes.some((code) => priceWithCode(product, code, currency) !== null);
}
