import { describe, expect, test } from "vitest";
import { DEFAULT_PLAN_CONFIG } from "./planDefaults";
import { formatBillingDate, isPendingChange, receiptKind } from "./planEmails";
import { DAY_MS } from "./plans";
import { pricesOf, type SubscriptionState } from "./subscriptions";

const NOW = Date.parse("2026-11-27T10:00:00Z");
const prices = pricesOf(DEFAULT_PLAN_CONFIG);
const trial: SubscriptionState = { plan: "pro", status: "trialing", periodStart: NOW - 10 * DAY_MS, periodEnd: NOW + 20 * DAY_MS };
const pro: SubscriptionState = {
  plan: "pro",
  status: "active",
  periodStart: NOW - 10 * DAY_MS,
  periodEnd: NOW + 20 * DAY_MS,
  paidStart: NOW - 10 * DAY_MS,
  paidEnd: NOW + 20 * DAY_MS,
};
const business: SubscriptionState = { ...pro, plan: "business" };
const free: SubscriptionState = { plan: "free", status: "free", periodStart: NOW - DAY_MS, periodEnd: null };

describe("receiptKind", () => {
  test("trial → same plan keeps the trial days; trial → Business ends the trial", () => {
    expect(receiptKind(trial, "pro", NOW, prices)).toEqual({ kind: "renewal", trial: "kept" });
    expect(receiptKind(trial, "business", NOW, prices)).toEqual({ kind: "upgrade", trial: "ended" });
  });

  test("paid upgrade, renewal, and from Free", () => {
    expect(receiptKind(pro, "business", NOW, prices)).toEqual({ kind: "upgrade", trial: null });
    expect(receiptKind(pro, "pro", NOW, prices)).toEqual({ kind: "renewal", trial: null });
    expect(receiptKind(free, "pro", NOW, prices)).toEqual({ kind: "upgrade", trial: null });
  });

  test("a payment that lands as a downgrade extended the current plan: a renewal", () => {
    expect(receiptKind(business, "pro", NOW, prices)).toEqual({ kind: "renewal", trial: null });
  });
});

describe("isPendingChange", () => {
  const change = { status: "scheduled" as const, toPlan: "free" as const, effectiveAt: pro.periodEnd! };
  test("only while scheduled and the plan still ends on the same date", () => {
    expect(isPendingChange(change, pro)).toBe(true);
    expect(isPendingChange({ ...change, status: "kept" }, pro)).toBe(false);
    expect(isPendingChange({ ...change, status: "replaced" }, pro)).toBe(false);
    expect(isPendingChange(change, { ...pro, periodEnd: pro.periodEnd! + 30 * DAY_MS })).toBe(false);
    expect(isPendingChange(change, free)).toBe(false);
  });
});

describe("formatBillingDate", () => {
  test("uses Nairobi time (UTC+3), not UTC", () => {
    const lateUtc = Date.parse("2026-11-30T22:30:00Z"); // 1 December, 01:30 in Nairobi
    expect(formatBillingDate(lateUtc, "en")).toBe("December 1, 2026");
    expect(formatBillingDate(lateUtc, "fr")).toBe("1 décembre 2026");
  });
});
