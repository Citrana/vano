import { describe, expect, test } from "vitest";
import { codeFieldFor, codeLiveAt, codeStatusAt, evaluateCode, isWrongAttempt, priceWithCode, type CodeLike } from "./active";
import { codeTextProblem, normalizeCode, suggestCode, SUGGEST_LENGTH } from "./code";
import { cleanVisitorId, codeScheduleProblem, maxUsesProblem } from "./rules";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 19, 12, 0); // 19 Nov 2026, 12:00 UTC

function code(overrides: Partial<CodeLike> = {}): CodeLike {
  return {
    _id: "c1",
    code: "WELCOME10",
    discount: { kind: "percent", value: 10 },
    target: { kind: "shop", excludedIds: [] },
    startsAt: NOW - HOUR,
    endsAt: NOW + DAY,
    paused: false,
    maxUses: null,
    uses: 0,
    ...overrides,
  };
}
const dress = { _id: "p1", price: 2500, category: "clothes" as const };
const shoes = { _id: "p2", price: 10_000, category: "shoes" as const };
const evaluate = (c: CodeLike | null, opts: { sale?: { price: number } | null; now?: number; alreadyUsed?: boolean } = {}) =>
  evaluateCode({ code: c, product: dress, sale: opts.sale ?? null, currency: "USD", now: opts.now ?? NOW, alreadyUsed: opts.alreadyUsed });

describe("code text", () => {
  test("not case sensitive, spaces removed", () => {
    expect(normalizeCode(" welcome 10 ")).toBe("WELCOME10");
  });

  test("3 to 20 letters and numbers", () => {
    expect(codeTextProblem("AB")).toBe("length");
    expect(codeTextProblem("ABC")).toBeNull();
    expect(codeTextProblem("A".repeat(20))).toBeNull();
    expect(codeTextProblem("A".repeat(21))).toBe("length");
    expect(codeTextProblem("SALE-10")).toBe("chars");
    expect(codeTextProblem("ÉTÉ10")).toBe("chars");
  });

  test("suggestions are valid, readable codes", () => {
    let i = 0;
    const seq = [0, 0.5, 0.99, 0.2, 0.7, 0.1, 0.4, 0.9];
    const s = suggestCode(() => seq[i++ % seq.length]);
    expect(s).toHaveLength(SUGGEST_LENGTH);
    expect(codeTextProblem(s)).toBeNull();
    expect(s).not.toMatch(/[01OIL]/);
    expect(suggestCode(() => 0.999999)).toMatch(/^[A-Z0-9]+$/);
  });
});

describe("rules", () => {
  test("maximum uses: a whole number from 1, never below the uses so far", () => {
    expect(maxUsesProblem(undefined)).toBeNull();
    expect(maxUsesProblem(1)).toBeNull();
    expect(maxUsesProblem(0)).toBe("range");
    expect(maxUsesProblem(2.5)).toBe("range");
    expect(maxUsesProblem(1_000_000)).toBe("range");
    expect(maxUsesProblem(4, 5)).toBe("belowUses");
    expect(maxUsesProblem(5, 5)).toBeNull();
  });

  test("dates follow the sale rules (end after start, in the future, not too long)", () => {
    expect(codeScheduleProblem({ endsAt: NOW + DAY }, NOW)).toBeNull();
    expect(codeScheduleProblem({ endsAt: NOW - 1 }, NOW)).toBe("ended");
    expect(codeScheduleProblem({ startsAt: NOW + DAY, endsAt: NOW + HOUR }, NOW)).toBe("order");
    expect(codeScheduleProblem({ endsAt: NOW + 100 * DAY }, NOW)).toBe("tooLong");
    expect(codeScheduleProblem({ startsAt: NOW + 400 * DAY, endsAt: NOW + 401 * DAY }, NOW)).toBe("tooFar");
  });

  test("visitor ids are random tokens; anything else is one shared key", () => {
    expect(cleanVisitorId("a1b2c3d4-e5f6")).toBe("a1b2c3d4-e5f6");
    expect(cleanVisitorId("short")).toBe("anonymous");
    expect(cleanVisitorId("x".repeat(65))).toBe("anonymous");
    expect(cleanVisitorId("has space 123")).toBe("anonymous");
  });
});

describe("price with a code", () => {
  test("percent off, rounded per currency (as sales)", () => {
    expect(priceWithCode(dress, code(), "USD")).toBe(2250);
    expect(priceWithCode({ ...dress, price: 2_500_000 }, code({ discount: { kind: "percent", value: 33 } }), "CDF")).toBe(1_680_000);
  });

  test("amount off; never zero or more than the price", () => {
    expect(priceWithCode(dress, code({ discount: { kind: "amount", value: 500 } }), "USD")).toBe(2000);
    expect(priceWithCode(dress, code({ discount: { kind: "amount", value: 2500 } }), "USD")).toBeNull();
  });

  test("where it applies: chosen products, a category (with exclusions) or the shop", () => {
    expect(priceWithCode(shoes, code({ target: { kind: "products", productIds: ["p1"] as never } }), "USD")).toBeNull();
    expect(priceWithCode(dress, code({ target: { kind: "category", category: "clothes", excludedIds: [] } }), "USD")).toBe(2250);
    expect(priceWithCode(shoes, code({ target: { kind: "category", category: "clothes", excludedIds: [] } }), "USD")).toBeNull();
    expect(priceWithCode(dress, code({ target: { kind: "shop", excludedIds: ["p1"] as never } }), "USD")).toBeNull();
  });

  test("the field shows only on products a live code lowers", () => {
    const codes = [code({ target: { kind: "category", category: "shoes", excludedIds: [] } })];
    expect(codeFieldFor(shoes, codes, "USD")).toBe(true);
    expect(codeFieldFor(dress, codes, "USD")).toBe(false);
    expect(codeFieldFor(dress, [], "USD")).toBe(false);
  });
});

describe("status and dates", () => {
  test("start inclusive, end exclusive (UTC ms, whatever the time zone)", () => {
    const c = code({ startsAt: NOW, endsAt: NOW + HOUR });
    expect(codeStatusAt(c, NOW - 1)).toBe("scheduled");
    expect(codeStatusAt(c, NOW)).toBe("running");
    expect(codeStatusAt(c, NOW + HOUR - 1)).toBe("running");
    expect(codeStatusAt(c, NOW + HOUR)).toBe("ended");
    expect(codeLiveAt(c, NOW)).toBe(true);
    expect(codeLiveAt(c, NOW + HOUR)).toBe(false);
  });

  test("ended beats used up beats paused", () => {
    expect(codeStatusAt(code({ paused: true, maxUses: 1, uses: 1, endsAt: NOW }), NOW)).toBe("ended");
    expect(codeStatusAt(code({ paused: true, maxUses: 1, uses: 1 }), NOW)).toBe("usedUp");
    expect(codeStatusAt(code({ adminPause: { at: NOW, reason: "x" } }), NOW)).toBe("paused");
    expect(codeLiveAt(code({ maxUses: 3, uses: 3 }), NOW)).toBe(false);
    expect(codeLiveAt(code({ maxUses: 3, uses: 2 }), NOW)).toBe(true);
  });
});

describe("evaluateCode", () => {
  test("a valid code gives the new price and the real price crossed out", () => {
    expect(evaluate(code())).toEqual({ status: "applied", code: "WELCOME10", price: 2250, original: 2500, percent: 10 });
  });

  test("friendly reasons when it doesn't work", () => {
    expect(evaluate(null).status).toBe("invalid");
    expect(evaluate(code({ endsAt: NOW })).status).toBe("ended");
    expect(evaluate(code({ startsAt: NOW + HOUR })).status).toBe("notActive");
    expect(evaluate(code({ paused: true })).status).toBe("notActive");
    expect(evaluate(code({ adminPause: { at: NOW, reason: "x" } })).status).toBe("notActive");
    expect(evaluate(code({ maxUses: 2, uses: 2 })).status).toBe("usedUp");
    expect(evaluate(code({ target: { kind: "products", productIds: ["p2"] as never } })).status).toBe("notForProduct");
  });

  test("a visitor who already used it on this product still gets it", () => {
    expect(evaluate(code({ maxUses: 2, uses: 2 }), { alreadyUsed: true }).status).toBe("applied");
  });

  test("sale + code: the best price wins, never both", () => {
    // Sale at 20.00, code would give 22.50: the sale is better.
    expect(evaluate(code(), { sale: { price: 2000 } }).status).toBe("saleBetter");
    // Same price: the sale stays (nothing to gain).
    expect(evaluate(code(), { sale: { price: 2250 } }).status).toBe("saleBetter");
    // Sale at 24.00, code 22.50 off the REAL price: the code wins, not stacked on the sale.
    expect(evaluate(code(), { sale: { price: 2400 } })).toMatchObject({ status: "applied", price: 2250, original: 2500 });
  });

  test("only wrong guesses count against the limits", () => {
    expect(isWrongAttempt({ status: "invalid" })).toBe(true);
    expect(isWrongAttempt({ status: "ended" })).toBe(true);
    expect(isWrongAttempt({ status: "saleBetter" })).toBe(false);
    expect(isWrongAttempt({ status: "tooMany" })).toBe(false);
    expect(isWrongAttempt(evaluate(code()))).toBe(false);
  });
});
