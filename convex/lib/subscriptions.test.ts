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
  stateAt,
  trialState,
  type SubscriptionState,
} from "./subscriptions";
import { newTest, sellerWithShop } from "./test.utils";

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

describe("trial and expiry", () => {
  test("a trial is two months of Pro", () => {
    const trial = trialState(NOW, 2);
    expect(trial).toMatchObject({ plan: "pro", status: "trialing", periodStart: NOW });
    expect(trial.periodEnd).toBe(addMonths(NOW, 2));
    expect(effectivePlan(trial)).toBe("pro");
  });
  test("an ended trial becomes free, an ended paid plan expired", () => {
    const trial = trialState(NOW - days(70), 2);
    expect(expireIfDue(trial, NOW)).toEqual({ plan: "free", status: "free", periodStart: trial.periodEnd, periodEnd: null });
    expect(expireIfDue(active("business", -1), NOW)).toMatchObject({ plan: "free", status: "expired" });
    expect(effectivePlan({ ...active("business", -1), status: "expired" })).toBe("free");
  });
  test("nothing to do before the end or on free", () => {
    expect(expireIfDue(active("pro", 1), NOW)).toBeNull();
    expect(expireIfDue({ plan: "free", status: "free", periodStart: 0, periodEnd: null }, NOW)).toBeNull();
    expect(stateAt(active("pro", 1), NOW)).toEqual(active("pro", 1));
  });
});

describe("applyPurchase", () => {
  test("same plan adds a period to the current end", () => {
    expect(applyPurchase(active("pro", 5), "pro", NOW, PRICES)).toMatchObject({ plan: "pro", status: "active", periodEnd: NOW + days(35) });
  });
  test("during the trial the remaining trial days are kept", () => {
    const trial = { ...trialState(NOW - days(10), 2), periodEnd: NOW + days(20) };
    expect(applyPurchase(trial, "business", NOW, PRICES)).toEqual({ plan: "business", status: "active", periodStart: NOW, periodEnd: NOW + days(50) });
  });
  test("upgrading converts unused days at the price ratio", () => {
    // 10 Pro days × 299 / 1000 = 2.99 Business days.
    const next = applyPurchase(active("pro", 10), "business", NOW, PRICES);
    expect(next.plan).toBe("business");
    expect(next.periodEnd).toBe(NOW + days(30) + Math.floor((days(10) * 29900) / 100000));
  });
  test("downgrading converts the other way (more days)", () => {
    const next = applyPurchase(active("business", 3), "pro", NOW, PRICES);
    expect(next.periodEnd).toBe(NOW + days(30) + Math.floor((days(3) * 100000) / 29900));
  });
  test("free, expired or an ended period start a fresh period now", () => {
    for (const state of [
      { plan: "free", status: "free", periodStart: 0, periodEnd: null } as SubscriptionState,
      { plan: "free", status: "expired", periodStart: 0, periodEnd: null } as SubscriptionState,
      active("pro", -3),
    ]) {
      expect(applyPurchase(state, "pro", NOW, PRICES)).toEqual({ plan: "pro", status: "active", periodStart: NOW, periodEnd: NOW + days(30) });
    }
  });
});

describe("extendState", () => {
  test("adds days to the current end, or from now if it passed", () => {
    expect(extendState(active("pro", 5), 10, NOW)?.periodEnd).toBe(NOW + days(15));
    expect(extendState({ plan: "free", status: "free", periodStart: 0, periodEnd: null }, 10, NOW)).toBeNull();
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
