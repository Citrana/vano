import { percentOff } from "../sales/discount";
import type { CodeResult } from "../discountCodes/validators";
import type { RecordOffer } from "./validators";

/**
 * Prices of a recorded sale (CLAUDE.md "Sales tracking"), pure. The
 * product's real price is never changed: a sale stores its own snapshot.
 */

/**
 * The price to prefill: the running sale's or a valid code's, whichever
 * is lower for the customer (never both), else the normal price.
 * `sale` = `saleForProduct` / `bestSaleFor`; `code` = `evaluateCode`.
 */
export function suggestedPrice(args: {
  normalPrice: number;
  sale: { price: number; percent: number } | null;
  code: CodeResult | null;
}): { price: number; offer: RecordOffer | null } {
  const { normalPrice, sale, code } = args;
  const codeApplied = code?.status === "applied" ? code : null;
  if (codeApplied && (!sale || codeApplied.price < sale.price)) {
    return { price: codeApplied.price, offer: { kind: "code", code: codeApplied.code, percent: codeApplied.percent } };
  }
  if (sale) return { price: sale.price, offer: { kind: "sale", percent: sale.percent } };
  return { price: normalPrice, offer: null };
}

/**
 * The sale's total and the discount the customer got against the normal
 * price (0 when they paid the normal price or more).
 */
export function recordTotals(args: { normalUnitPrice: number; finalUnitPrice: number; quantity: number }): {
  total: number;
  discount: number;
} {
  const total = args.finalUnitPrice * args.quantity;
  return { total, discount: Math.max(0, args.normalUnitPrice * args.quantity - total) };
}

/** The discount in percent of the normal price, for display (0 when none). */
export function discountPercent(normalUnitPrice: number, finalUnitPrice: number): number {
  return finalUnitPrice < normalUnitPrice ? percentOff(normalUnitPrice, finalUnitPrice) : 0;
}

export type RecordTotals = { count: number; items: number; revenue: number; discounts: number };

/** Totals of a list: reversed sales are listed but never counted. */
export function sumRecords(
  records: readonly { status: "recorded" | "reversed"; quantity: number; total: number; discount: number }[],
): RecordTotals {
  const totals: RecordTotals = { count: 0, items: 0, revenue: 0, discounts: 0 };
  for (const r of records) {
    if (r.status !== "recorded") continue;
    totals.count += 1;
    totals.items += r.quantity;
    totals.revenue += r.total;
    totals.discounts += r.discount;
  }
  return totals;
}
