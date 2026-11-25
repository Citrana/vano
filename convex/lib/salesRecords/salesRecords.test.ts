import { describe, expect, test } from "vitest";
import { discountPercent, recordTotals, suggestedPrice, sumRecords } from "./pricing";
import {
  cleanCustomerPhone,
  cleanOption,
  customerNameProblem,
  defaultMarkSoldOut,
  finalPriceProblem,
  quantityProblem,
  soldAtProblem,
} from "./rules";

const NOW = Date.UTC(2026, 10, 19, 12);
const DAY = 86_400_000;

describe("recorded sales: price to prefill", () => {
  test("normal price when nothing applies", () => {
    expect(suggestedPrice({ normalPrice: 2500, sale: null, code: null })).toEqual({ price: 2500, offer: null });
  });

  test("the running sale", () => {
    expect(suggestedPrice({ normalPrice: 2500, sale: { price: 2000, percent: 20 }, code: null })).toEqual({
      price: 2000,
      offer: { kind: "sale", percent: 20 },
    });
  });

  test("a valid code lower than the sale wins; never both", () => {
    const code = { status: "applied" as const, code: "VIP", price: 1500, original: 2500, percent: 40 };
    expect(suggestedPrice({ normalPrice: 2500, sale: { price: 2000, percent: 20 }, code })).toEqual({
      price: 1500,
      offer: { kind: "code", code: "VIP", percent: 40 },
    });
  });

  test("a code that isn't better or doesn't apply keeps the sale", () => {
    const sale = { price: 2000, percent: 20 };
    expect(suggestedPrice({ normalPrice: 2500, sale, code: { status: "saleBetter" } }).offer).toEqual({ kind: "sale", percent: 20 });
    expect(suggestedPrice({ normalPrice: 2500, sale, code: { status: "invalid" } }).price).toBe(2000);
    const equal = { status: "applied" as const, code: "SAME", price: 2000, original: 2500, percent: 20 };
    expect(suggestedPrice({ normalPrice: 2500, sale, code: equal }).offer?.kind).toBe("sale");
  });
});

describe("recorded sales: totals and discount", () => {
  test("quantity × final price; discount against the normal price", () => {
    expect(recordTotals({ normalUnitPrice: 2500, finalUnitPrice: 2000, quantity: 3 })).toEqual({ total: 6000, discount: 1500 });
  });

  test("negotiated above the normal price: no negative discount", () => {
    expect(recordTotals({ normalUnitPrice: 2500, finalUnitPrice: 3000, quantity: 2 })).toEqual({ total: 6000, discount: 0 });
    expect(discountPercent(2500, 3000)).toBe(0);
    expect(discountPercent(2500, 2000)).toBe(20);
  });

  test("list totals skip reversed sales", () => {
    const totals = sumRecords([
      { status: "recorded", quantity: 2, total: 4000, discount: 1000 },
      { status: "reversed", quantity: 5, total: 9999, discount: 99 },
      { status: "recorded", quantity: 1, total: 2500, discount: 0 },
    ]);
    expect(totals).toEqual({ count: 2, items: 3, revenue: 6500, discounts: 1000 });
  });
});

describe("recorded sales: rules", () => {
  test("quantity 1–999, whole numbers", () => {
    expect(quantityProblem(1)).toBeNull();
    expect(quantityProblem(999)).toBeNull();
    expect(quantityProblem(0)).toBe("range");
    expect(quantityProblem(1000)).toBe("range");
    expect(quantityProblem(1.5)).toBe("range");
  });

  test("final price: positive integer minor units", () => {
    expect(finalPriceProblem(1)).toBeNull();
    expect(finalPriceProblem(0)).toBe("notPositive");
    expect(finalPriceProblem(10.5)).toBe("notInteger");
  });

  test("date: not in the future (small slack), not older than two years", () => {
    expect(soldAtProblem(NOW, NOW)).toBeNull();
    expect(soldAtProblem(NOW + 60_000, NOW)).toBeNull();
    expect(soldAtProblem(NOW + DAY, NOW)).toBe("future");
    expect(soldAtProblem(NOW - 731 * DAY, NOW)).toBe("tooOld");
    expect(soldAtProblem(Number.NaN, NOW)).toBe("future");
  });

  test("options: required when the product has some, one of them, product spelling", () => {
    expect(cleanOption(undefined, [])).toEqual({ ok: true, value: undefined });
    expect(cleanOption("M", [])).toEqual({ ok: false, problem: "unknown" });
    expect(cleanOption("", ["S", "M"])).toEqual({ ok: false, problem: "required" });
    expect(cleanOption(" m ", ["S", "M"])).toEqual({ ok: true, value: "M" });
    expect(cleanOption("XL", ["S", "M"])).toEqual({ ok: false, problem: "unknown" });
  });

  test("customer: name length, phone normalized with the shop's country", () => {
    expect(customerNameProblem(undefined)).toBeNull();
    expect(customerNameProblem("x".repeat(61))).toBe("tooLong");
    expect(cleanCustomerPhone("", "CD")).toBeUndefined();
    expect(cleanCustomerPhone("0812 345 678", "CD")).toBe("+243812345678");
    expect(cleanCustomerPhone("123", "CD")).toBeNull();
  });

  test("sold out starts on only for a product without sizes or colours", () => {
    expect(defaultMarkSoldOut({ sizes: [], colors: [] })).toBe(true);
    expect(defaultMarkSoldOut({ sizes: ["M"], colors: [] })).toBe(false);
    expect(defaultMarkSoldOut({ sizes: [], colors: ["Red"] })).toBe(false);
  });
});
