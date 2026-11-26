import { describe, expect, test } from "vitest";
import { addMonths } from "./days";
import { LIMITS } from "./catalog";
import {
  DAY_MS,
  PLAN_IDS,
  daysLeft,
  grantDaysProblem,
  grantReasonProblem,
} from "./plans";
import { DEFAULT_PLAN_CONFIG } from "./planDefaults";
import { resolvePlanLimits } from "./planFeatures";
import {
  applyPurchase,
  pricesOf,
  effectivePlan,
  expireIfDue,
  extendState,
  graceEndOf,
  inGrace,
  paidDaysLeft,
  planChangeKind,
  quotePurchase,
  stateAt,
  stateOf,
  trialState,
  upgradeCreditMinor,
  type SubscriptionState,
} from "./subscriptions";
import { as, insertUser, newTest, sellerWithShop, shopArgs } from "./test.utils";
import { api } from "../_generated/api";

const NOW = Date.UTC(2026, 10, 18, 12);
const PRICES = pricesOf(DEFAULT_PLAN_CONFIG);
const PLAN_LIMITS = Object.fromEntries(PLAN_IDS.map((id) => [id, resolvePlanLimits(DEFAULT_PLAN_CONFIG, id)]));
const days = (n: number) => n * DAY_MS;
const active = (plan: SubscriptionState["plan"], endInDays: number): SubscriptionState => ({
  plan,
  status: "active",
  periodStart: NOW - days(10),
  periodEnd: NOW + days(endInDays),
});
/** An active plan whose last `paidDays` of the period were paid for. */
const paid = (plan: SubscriptionState["plan"], endInDays: number, paidDays = 30): SubscriptionState => ({
  ...active(plan, endInDays),
  paidStart: NOW + days(endInDays - paidDays),
  paidEnd: NOW + days(endInDays),
});
const FREE: SubscriptionState = { plan: "free", status: "free", periodStart: 0, periodEnd: null };

describe("plan config", () => {
  test("plan photo limits never exceed the platform ceiling", () => {
    for (const id of PLAN_IDS) {
      expect(PLAN_LIMITS[id].photosPerProduct).toBeLessThanOrEqual(LIMITS.maxImages);
      const products = PLAN_LIMITS[id].products;
      if (products !== null) expect(products).toBeLessThanOrEqual(LIMITS.maxProducts);
    }
  });
  test("grant rules", () => {
    expect(grantReasonProblem("  ok  ")).toBe("length");
    expect(grantReasonProblem("Promo partner")).toBeNull();
    expect(grantReasonProblem("x".repeat(501))).toBe("length");
    expect(grantDaysProblem(0)).toBe("range");
    expect(grantDaysProblem(1.5)).toBe("range");
    expect(grantDaysProblem(30)).toBeNull();
    expect(grantDaysProblem(367)).toBe("range");
  });
  test("daysLeft rounds up and never goes negative", () => {
    expect(daysLeft(NOW + days(2) + 1, NOW)).toBe(3);
    expect(daysLeft(NOW - 1, NOW)).toBe(0);
  });
});

describe("addMonths", () => {
  test("clamps to the end of shorter months", () => {
    expect(new Date(addMonths(Date.UTC(2026, 0, 31), 1)).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(new Date(addMonths(Date.UTC(2026, 10, 18, 9), 2)).toISOString()).toBe("2027-01-18T09:00:00.000Z");
  });
});

describe("trial, grace and expiry", () => {
  test("a trial is two months of Pro", () => {
    const trial = trialState(NOW, 2);
    expect(trial).toMatchObject({ plan: "pro", status: "trialing", periodStart: NOW });
    expect(trial.periodEnd).toBe(addMonths(NOW, 2));
    expect(effectivePlan(trial)).toBe("pro");
  });
  test("an ended trial keeps Pro for 3 grace days, then becomes free", () => {
    const trial = { ...trialState(NOW - days(70), 2), periodEnd: NOW - days(1) };
    expect(expireIfDue(trial, NOW)).toBeNull();
    expect(inGrace(trial, NOW)).toBe(true);
    expect(effectivePlan(stateAt(trial, NOW))).toBe("pro");
    expect(graceEndOf(trial)).toBe(NOW + days(2));
    expect(expireIfDue(trial, NOW + days(2))).toEqual({
      plan: "free",
      status: "free",
      periodStart: NOW + days(2),
      periodEnd: null,
      trialEndedAt: NOW + days(2),
    });
    expect(inGrace(trial, NOW + days(2))).toBe(false);
  });
  test("an ended paid plan becomes expired after its grace days", () => {
    expect(expireIfDue(active("business", -2), NOW)).toBeNull();
    expect(expireIfDue(active("business", -3), NOW)).toMatchObject({ plan: "free", status: "expired" });
    expect(expireIfDue(active("business", -3), NOW)?.trialEndedAt).toBeUndefined();
    expect(effectivePlan({ ...active("business", -1), status: "expired" })).toBe("free");
  });
  test("nothing to do before the end or on free", () => {
    expect(expireIfDue(active("pro", 1), NOW)).toBeNull();
    expect(inGrace(active("pro", 1), NOW)).toBe(false);
    expect(expireIfDue(FREE, NOW)).toBeNull();
    expect(graceEndOf(FREE)).toBeNull();
    expect(stateAt(active("pro", 1), NOW)).toEqual(active("pro", 1));
  });
});

describe("paidDaysLeft", () => {
  test("counts whole paid days only, never more than 30", () => {
    expect(paidDaysLeft(paid("pro", 10), NOW)).toBe(10);
    expect(paidDaysLeft({ ...paid("pro", 10), periodEnd: NOW + days(10.6), paidEnd: NOW + days(10.6) }, NOW)).toBe(10);
    // Renewed twice: 60 paid days left, capped at one period.
    expect(paidDaysLeft({ ...paid("pro", 60, 60) }, NOW)).toBe(30);
  });
  test("trial, admin and grace days are not paid days", () => {
    expect(paidDaysLeft(trialState(NOW, 2), NOW)).toBe(0);
    expect(paidDaysLeft(active("pro", 20), NOW)).toBe(0);
    expect(paidDaysLeft(paid("pro", -1), NOW)).toBe(0);
  });
  test("paid days bought during the trial start when the trial ends", () => {
    // Trial ends in 20 days, then 30 paid days: all 30 are still ahead.
    const state = { ...paid("pro", 50, 30) };
    expect(paidDaysLeft(state, NOW)).toBe(30);
  });
  test("rows from before the paid window was stored: the last 30 days of a paid plan", () => {
    const doc = {
      plan: "pro",
      status: "active",
      periodStart: NOW - days(20),
      periodEnd: NOW + days(10),
      source: "payment",
    } as unknown as Parameters<typeof stateOf>[0];
    expect(paidDaysLeft(stateOf(doc), NOW)).toBe(10);
    expect(paidDaysLeft(stateOf({ ...doc, source: "admin" }), NOW)).toBe(0);
  });
});

describe("upgradeCreditMinor", () => {
  test("10 paid Pro days left = 100 credit (299 × 10 / 30, whole shillings)", () => {
    expect(upgradeCreditMinor(paid("pro", 10), "business", NOW, PRICES)).toBe(10000);
  });
  test("capped at one period, and never on the trial, a renewal or a downgrade", () => {
    expect(upgradeCreditMinor(paid("pro", 60, 60), "business", NOW, PRICES)).toBe(29900);
    expect(upgradeCreditMinor(trialState(NOW, 2), "business", NOW, PRICES)).toBe(0);
    expect(upgradeCreditMinor(paid("pro", 10), "pro", NOW, PRICES)).toBe(0);
    expect(upgradeCreditMinor(paid("business", 10), "pro", NOW, PRICES)).toBe(0);
  });
  test("at least 1 KSh is always paid, even if the old plan costs more", () => {
    const prices = { ...PRICES, pro: 200000 };
    expect(upgradeCreditMinor(paid("pro", 30), "business", NOW, prices)).toBe(100000 - 100);
  });
});

describe("planChangeKind", () => {
  test("from the trial", () => {
    const trial = trialState(NOW, 2);
    expect(planChangeKind(trial, "pro", NOW)).toBe("renew");
    expect(planChangeKind(trial, "business", NOW)).toBe("upgrade");
    expect(planChangeKind(trial, "free", NOW)).toBe("downgrade");
  });
  test("from Free, expired or an ended period, every paid plan is an upgrade", () => {
    expect(planChangeKind(FREE, "free", NOW)).toBe("current");
    expect(planChangeKind(FREE, "business", NOW)).toBe("upgrade");
    expect(planChangeKind(active("business", -5), "business", NOW)).toBe("upgrade");
  });
  test("between paid plans", () => {
    expect(planChangeKind(active("pro", 5), "business", NOW)).toBe("upgrade");
    expect(planChangeKind(active("business", 5), "pro", NOW)).toBe("downgrade");
    expect(planChangeKind(active("enterprise", 5), "business", NOW)).toBe("downgrade");
  });
});

describe("quotePurchase / applyPurchase", () => {
  test("trial → Pro: 299, the 30 paid days come after the trial ends", () => {
    const trial = { ...trialState(NOW - days(40), 2), periodEnd: NOW + days(20) };
    const quote = quotePurchase(trial, "pro", NOW, PRICES);
    expect(quote).toMatchObject({ kind: "renew", amountMinor: 29900, creditMinor: 0 });
    expect(quote.next).toEqual({
      plan: "pro",
      status: "active",
      periodStart: NOW,
      periodEnd: NOW + days(50),
      paidStart: NOW + days(20),
      paidEnd: NOW + days(50),
    });
  });
  test("trial → Business: the trial ends, full 1,000, today + 30 days", () => {
    const trial = { ...trialState(NOW - days(10), 2), periodEnd: NOW + days(20) };
    const quote = quotePurchase(trial, "business", NOW, PRICES);
    expect(quote).toMatchObject({ kind: "upgrade", amountMinor: 100000, creditMinor: 0 });
    expect(quote.next).toEqual({
      plan: "business",
      status: "active",
      periodStart: NOW,
      periodEnd: NOW + days(30),
      paidStart: NOW,
      paidEnd: NOW + days(30),
    });
  });
  test("paid Pro → Business: 10 paid days left = pay 900, today + 30 days", () => {
    const quote = quotePurchase(paid("pro", 10), "business", NOW, PRICES);
    expect(quote).toMatchObject({ kind: "upgrade", amountMinor: 90000, creditMinor: 10000 });
    expect(quote.next).toMatchObject({ plan: "business", periodStart: NOW, periodEnd: NOW + days(30) });
  });
  test("Pro bought during the trial, then Business: the paid days still ahead count (pay 701)", () => {
    const state = paid("pro", 50, 30);
    expect(quotePurchase(state, "business", NOW, PRICES)).toMatchObject({ amountMinor: 100000 - 29900, creditMinor: 29900 });
  });
  test("Pro in its grace days → Business: no paid days left, full price", () => {
    expect(quotePurchase(paid("pro", -1), "business", NOW, PRICES)).toMatchObject({ amountMinor: 100000, creditMinor: 0 });
  });
  test("same plan: full price, 30 days after the current end (also in grace)", () => {
    expect(quotePurchase(paid("business", 5), "business", NOW, PRICES)).toMatchObject({
      kind: "renew",
      amountMinor: 100000,
      next: { periodEnd: NOW + days(35), paidStart: NOW + days(-25), paidEnd: NOW + days(35) },
    });
    expect(quotePurchase(active("pro", -1), "pro", NOW, PRICES).next.periodEnd).toBe(NOW + days(29));
  });
  test("Free / expired / an ended period: full price, today + 30 days", () => {
    for (const state of [FREE, { ...FREE, status: "expired" } as SubscriptionState, active("pro", -3)]) {
      const quote = quotePurchase(state, "business", NOW, PRICES);
      expect(quote).toMatchObject({ kind: "upgrade", amountMinor: 100000, creditMinor: 0 });
      expect(quote.next).toMatchObject({ plan: "business", status: "active", periodStart: NOW, periodEnd: NOW + days(30) });
    }
  });
  test("downgrade: nothing charged, nothing changes now", () => {
    const state = paid("business", 12);
    expect(quotePurchase(state, "pro", NOW, PRICES)).toEqual({ kind: "downgrade", amountMinor: 0, creditMinor: 0, next: state });
  });
  test("a payment that lands as a downgrade still gives 30 days (on the current plan)", () => {
    const next = applyPurchase(paid("business", 12), "pro", NOW, PRICES);
    expect(next).toMatchObject({ plan: "business", periodEnd: NOW + days(42) });
  });
  test("applyPurchase is the quote's new state otherwise", () => {
    expect(applyPurchase(paid("pro", 10), "business", NOW, PRICES)).toEqual(quotePurchase(paid("pro", 10), "business", NOW, PRICES).next);
  });
});

describe("extendState", () => {
  test("adds days to the current end, or from now if it passed; paid days unchanged", () => {
    expect(extendState(active("pro", 5), 10, NOW)?.periodEnd).toBe(NOW + days(15));
    const extended = extendState(paid("pro", 5), 10, NOW)!;
    expect(paidDaysLeft(extended, NOW)).toBe(5);
    expect(extendState(FREE, 10, NOW)).toBeNull();
  });
});

describe("shops.create starts the trial", () => {
  test("a new shop gets a Pro trial row (not an activity entry)", async () => {
    const t = newTest();
    const { shopId } = await sellerWithShop(t);
    const { sub, logs } = await t.run(async (ctx) => ({
      sub: await ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique(),
      logs: await ctx.db.query("auditLogs").collect(),
    }));
    expect(sub).toMatchObject({ plan: "pro", status: "trialing", source: "trial", shopName: "Chez Amani" });
    expect(sub!.periodEnd).toBe(addMonths(sub!.periodStart, 2));
    expect(logs).toHaveLength(0);
  });

  test('"Get Business" (startPlan) skips the trial: the shop starts on Free', async () => {
    const t = newTest();
    const userId = await insertUser(t, "biz@x.com");
    const shopId = await as(t, userId).mutation(api.shops.create, { ...shopArgs({ slug: "biz-shop" }), startPlan: "business" });
    const sub = await t.run((ctx) =>
      ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique(),
    );
    expect(sub).toMatchObject({ plan: "free", status: "free", source: "system" });
    expect(sub!.periodEnd).toBeUndefined();
  });

  test("renaming the shop keeps the subscription's shop name in sync", async () => {
    const t = newTest();
    const { shopId } = await sellerWithShop(t);
    const { syncShopName } = await import("./shopChanges");
    await t.run((ctx) => syncShopName(ctx, shopId, "Maison Amani"));
    const sub = await t.run((ctx) =>
      ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique(),
    );
    expect(sub?.shopName).toBe("Maison Amani");
  });
});
