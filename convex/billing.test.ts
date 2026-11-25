import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DAY_MS } from "./lib/plans";
import { DEFAULT_PLAN_CONFIG } from "./lib/planDefaults";
import { as, builtInRoles, insertProducts, insertUser, insertUserWithRole, newTest, sellerWithShop, setSubscription, type T } from "./lib/test.utils";
import { mockEvent, mockRef } from "./payments/mock";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("PAYMENTS_PROVIDER", "mock");
  vi.stubEnv("PAYMENTS_MOCK_ENABLED", "true");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const subOf = (t: T, shopId: Id<"shops">) =>
  t.run((ctx) => ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique());
const paymentOf = (t: T, id: Id<"payments">) => t.run((ctx) => ctx.db.get("payments", id));
const actions = (t: T) => t.run(async (ctx) => (await ctx.db.query("auditLogs").collect()).map((l) => l.action));

/** A seller on Free with a checkout handed to the mock provider. */
async function checkout(t: T, plan: "pro" | "business" = "pro") {
  const seller = await sellerWithShop(t);
  await setSubscription(t, seller.shopId, { plan: "free", status: "free" });
  const me = as(t, seller.userId);
  const paymentId = await me.mutation(api.billing.startCheckout, { plan });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { ...seller, me, paymentId };
}

describe("startCheckout", () => {
  test("creates a payment priced from the plan config and hands it to the provider", async () => {
    const t = newTest();
    const { paymentId, me, userId } = await checkout(t, "business");
    expect(await paymentOf(t, paymentId)).toMatchObject({
      plan: "business",
      amountMinor: DEFAULT_PLAN_CONFIG.plans.business.monthlyMinor,
      currency: "KES",
      provider: "mock",
      status: "pending",
      providerRef: mockRef(paymentId),
      next: { kind: "mockCheckout" },
      userId,
    });
    expect(await me.query(api.billing.payment, { paymentId })).toMatchObject({ status: "pending", testMode: true });
    expect(await actions(t)).toEqual(["payment.started"]);
  });

  test("reuses an open checkout for the same plan, cancels one for another plan", async () => {
    const t = newTest();
    const { paymentId, me } = await checkout(t, "pro");
    expect(await me.mutation(api.billing.startCheckout, { plan: "pro" })).toBe(paymentId);
    const other = await me.mutation(api.billing.startCheckout, { plan: "business" });
    expect(other).not.toBe(paymentId);
    expect((await paymentOf(t, paymentId))?.status).toBe("cancelled");
  });

  test("payments off: PAYMENTS_UNAVAILABLE (and the mock needs both env vars)", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    vi.stubEnv("PAYMENTS_MOCK_ENABLED", "");
    await expect(as(t, userId).mutation(api.billing.startCheckout, { plan: "pro" })).rejects.toThrow(/PAYMENTS_UNAVAILABLE/);
    vi.stubEnv("PAYMENTS_MOCK_ENABLED", "true");
    vi.stubEnv("PAYMENTS_PROVIDER", "");
    await expect(as(t, userId).mutation(api.billing.startCheckout, { plan: "pro" })).rejects.toThrow(/PAYMENTS_UNAVAILABLE/);
  });

  test("the amount follows the admin's price; a hidden plan can't be bought", async () => {
    const t = newTest();
    const roles = await builtInRoles(t);
    const admin = as(t, await insertUserWithRole(t, "boss@vano.app", roles.super_admin));
    const v1 = await admin.mutation(api.admin.plans.updatePlan, {
      expectedVersion: 0,
      plan: "pro",
      settings: { ...DEFAULT_PLAN_CONFIG.plans.pro, monthlyMinor: 39900 },
    });
    const { paymentId, me } = await checkout(t, "pro");
    expect((await paymentOf(t, paymentId))?.amountMinor).toBe(39900);
    await admin.mutation(api.admin.plans.updatePlan, {
      expectedVersion: v1,
      plan: "business",
      settings: { ...DEFAULT_PLAN_CONFIG.plans.business, visible: false },
    });
    await expect(me.mutation(api.billing.startCheckout, { plan: "business" })).rejects.toThrow(/PLAN_INVALID/);
  });

  test("needs a shop; a suspended shop can't check out", async () => {
    const t = newTest();
    const noShop = await insertUser(t, "x@x.com");
    await expect(as(t, noShop).mutation(api.billing.startCheckout, { plan: "pro" })).rejects.toThrow(/NO_SHOP/);
    const { userId, shopId } = await sellerWithShop(t);
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    await expect(as(t, userId).mutation(api.billing.startCheckout, { plan: "pro" })).rejects.toThrow(/SHOP_SUSPENDED/);
  });
});

describe("plan changes: amounts and new periods", () => {
  const pay = async (t: T, me: ReturnType<typeof as>, plan: "pro" | "business") => {
    const paymentId = await me.mutation(api.billing.startCheckout, { plan });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return paymentId;
  };

  test("trial → Business: full 1,000, the trial ends, Business today + 30 days", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    const me = as(t, seller.userId);
    const paymentId = await pay(t, me, "business");
    expect(await paymentOf(t, paymentId)).toMatchObject({ amountMinor: 100000 });
    expect((await paymentOf(t, paymentId))?.creditMinor).toBeUndefined();
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" });
    expect(await subOf(t, seller.shopId)).toMatchObject({
      plan: "business",
      status: "active",
      periodStart: Date.now(),
      periodEnd: Date.now() + 30 * DAY_MS,
      paidStart: Date.now(),
      paidEnd: Date.now() + 30 * DAY_MS,
    });
  });

  test("trial → Pro: 299, the 30 paid days start when the trial ends", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    const trialEnd = (await subOf(t, seller.shopId))!.periodEnd!;
    const me = as(t, seller.userId);
    const paymentId = await pay(t, me, "pro");
    expect(await paymentOf(t, paymentId)).toMatchObject({ amountMinor: 29900 });
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" });
    expect(await subOf(t, seller.shopId)).toMatchObject({
      plan: "pro",
      status: "active",
      periodEnd: trialEnd + 30 * DAY_MS,
      paidStart: trialEnd,
      paidEnd: trialEnd + 30 * DAY_MS,
    });
  });

  test("paid Pro → Business with 10 paid days left: credit 100, pay 900, Business today + 30", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    const end = Date.now() + 10 * DAY_MS;
    await setSubscription(t, seller.shopId, { plan: "pro", status: "active", periodEnd: end, paidStart: end - 30 * DAY_MS, paidEnd: end, source: "payment" });
    const me = as(t, seller.userId);
    const paymentId = await pay(t, me, "business");
    expect(await paymentOf(t, paymentId)).toMatchObject({ amountMinor: 90000, creditMinor: 10000 });
    expect(await me.query(api.billing.payment, { paymentId })).toMatchObject({ amountMinor: 90000, creditMinor: 10000 });
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" });
    expect(await subOf(t, seller.shopId)).toMatchObject({ plan: "business", periodEnd: Date.now() + 30 * DAY_MS });
  });

  test("admin-granted Pro days give no credit", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    await setSubscription(t, seller.shopId, { plan: "pro", status: "active", periodEnd: Date.now() + 10 * DAY_MS, source: "admin" });
    const paymentId = await pay(t, as(t, seller.userId), "business");
    expect(await paymentOf(t, paymentId)).toMatchObject({ amountMinor: 100000 });
  });

  test("an open checkout whose credit changed since is replaced at today's amount", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    const end = Date.now() + 10 * DAY_MS;
    await setSubscription(t, seller.shopId, { plan: "pro", status: "active", periodEnd: end, paidStart: end - 30 * DAY_MS, paidEnd: end, source: "payment" });
    const me = as(t, seller.userId);
    const first = await pay(t, me, "business");
    expect(await pay(t, me, "business")).toBe(first);
    vi.advanceTimersByTime(3 * DAY_MS);
    const second = await pay(t, me, "business");
    expect(second).not.toBe(first);
    expect((await paymentOf(t, first))?.status).toBe("cancelled");
    // 7 paid days left: round(299 × 7 / 30) = 70.
    expect(await paymentOf(t, second)).toMatchObject({ amountMinor: 93000, creditMinor: 7000 });
  });

  test("a downgrade is never charged (the current plan runs to its end)", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    await setSubscription(t, seller.shopId, { plan: "business", status: "active", periodEnd: Date.now() + 10 * DAY_MS });
    await expect(as(t, seller.userId).mutation(api.billing.startCheckout, { plan: "pro" })).rejects.toThrow(/PLAN_INVALID/);
  });

  test("renewing during the grace days adds 30 days after the old end", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    const end = Date.now() - DAY_MS;
    await setSubscription(t, seller.shopId, { plan: "pro", status: "active", periodEnd: end });
    const me = as(t, seller.userId);
    expect((await me.query(api.billing.mine, {})).effectivePlan).toBe("pro");
    const paymentId = await pay(t, me, "pro");
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" });
    expect((await subOf(t, seller.shopId))!.periodEnd).toBe(end + 30 * DAY_MS);
  });
});

describe("downgradeImpact", () => {
  test("lists what would pause from the shop's real data; nothing is changed", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    await setSubscription(t, seller.shopId, { plan: "business", status: "active", periodEnd: Date.now() + 10 * DAY_MS });
    await insertProducts(t, seller.shopId, 12);
    const me = as(t, seller.userId);
    expect(await me.query(api.billing.downgradeImpact, { plan: "free" })).toMatchObject({ productsHidden: 2, sales: 0, discountCodes: 0, look: false });
    expect(await me.query(api.billing.downgradeImpact, { plan: "pro" })).toMatchObject({ productsHidden: 0 });
    expect(await subOf(t, seller.shopId)).toMatchObject({ plan: "business", status: "active" });
  });

  test("own shop only; signed-out callers are refused", async () => {
    const t = newTest();
    await expect(t.query(api.billing.downgradeImpact, { plan: "free" })).rejects.toThrow(/NOT_AUTHENTICATED/);
    const noShop = await insertUser(t, "noshop@x.com");
    await expect(as(t, noShop).query(api.billing.downgradeImpact, { plan: "free" })).rejects.toThrow(/NOT_FOUND|NO_SHOP/);
  });
});

describe("mock results", () => {
  test("success activates the plan for 30 days, once — even when repeated", async () => {
    const t = newTest();
    const { me, paymentId, shopId } = await checkout(t);
    expect(await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" })).toBe("applied");
    const sub = await subOf(t, shopId);
    expect(sub).toMatchObject({ plan: "pro", status: "active", source: "payment" });
    expect(sub!.periodEnd).toBe(Date.now() + 30 * DAY_MS);
    expect(await paymentOf(t, paymentId)).toMatchObject({ status: "succeeded", appliedAt: Date.now(), periodEndAfter: sub!.periodEnd });

    // Double click, webhook replay, late failure: nothing changes.
    expect(await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" })).toBe("duplicate");
    expect(await t.mutation(internal.payments.core.applyResult, { provider: "mock", event: mockEvent(paymentId, "succeeded") })).toBe("duplicate");
    expect(await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "failed" })).toBe("ignored");
    expect((await subOf(t, shopId))!.periodEnd).toBe(sub!.periodEnd);
    expect((await paymentOf(t, paymentId))?.status).toBe("succeeded");
    expect(await actions(t)).toEqual(["payment.started", "subscription.activated", "payment.succeeded"]);
  });

  test("failure and cancel change nothing on the plan", async () => {
    const t = newTest();
    const { me, paymentId, shopId } = await checkout(t);
    expect(await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "failed" })).toBe("recorded");
    expect(await paymentOf(t, paymentId)).toMatchObject({ status: "failed", failureCode: "mock_declined" });
    expect(await subOf(t, shopId)).toMatchObject({ plan: "free", status: "free" });

    const second = await me.mutation(api.billing.startCheckout, { plan: "pro" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await me.mutation(api.billing.cancelCheckout, { paymentId: second });
    expect((await paymentOf(t, second))?.status).toBe("cancelled");
    expect(await subOf(t, shopId)).toMatchObject({ plan: "free", status: "free" });
    await expect(me.mutation(api.billing.cancelCheckout, { paymentId: second })).rejects.toThrow(/PAYMENT_NOT_OPEN/);
  });

  test("pending can be completed later", async () => {
    const t = newTest();
    const { me, paymentId, shopId } = await checkout(t, "business");
    expect(await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "pending" })).toBe("recorded");
    expect(await paymentOf(t, paymentId)).toMatchObject({ status: "pending", pendingReportedAt: Date.now() });
    expect((await subOf(t, shopId))?.plan).toBe("free");
    expect((await me.query(api.billing.mine, {})).openPaymentId).toBe(paymentId);
    expect(await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" })).toBe("applied");
    expect(await subOf(t, shopId)).toMatchObject({ plan: "business", status: "active" });
  });

  test("pending can fail later", async () => {
    const t = newTest();
    const { me, paymentId, shopId } = await checkout(t);
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "pending" });
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "failed" });
    expect((await paymentOf(t, paymentId))?.status).toBe("failed");
    expect((await subOf(t, shopId))?.plan).toBe("free");
  });

  test("mock disabled: simulating is refused even with a valid payment", async () => {
    const t = newTest();
    const { me, paymentId } = await checkout(t);
    vi.stubEnv("PAYMENTS_MOCK_ENABLED", "false");
    await expect(me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" })).rejects.toThrow(/PAYMENTS_UNAVAILABLE/);
    expect((await me.query(api.billing.mine, {})).payments).toEqual({ available: false, testMode: false });
  });

  test("another seller's payment is NOT_FOUND / null", async () => {
    const t = newTest();
    const { paymentId } = await checkout(t);
    const other = await sellerWithShop(t, "b@x.com", { slug: "other-shop" });
    const them = as(t, other.userId);
    await expect(them.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" })).rejects.toThrow(/NOT_FOUND/);
    await expect(them.mutation(api.billing.cancelCheckout, { paymentId })).rejects.toThrow(/NOT_FOUND/);
    expect(await them.query(api.billing.payment, { paymentId })).toBeNull();
    expect(await them.query(api.billing.payment, { paymentId: "nope" })).toBeNull();
    expect((await them.query(api.billing.payments, { paginationOpts: { numItems: 10, cursor: null } })).page).toEqual([]);
  });

  test("an unknown provider reference is ignored", async () => {
    const t = newTest();
    const result = await t.mutation(internal.payments.core.applyResult, {
      provider: "mock",
      event: { eventId: "x", providerRef: "mock_unknown", outcome: "succeeded" },
    });
    expect(result).toBe("unknown");
  });
});

describe("billing.mine and history", () => {
  test("a new shop shows the trial; history lists own payments newest first", async () => {
    const t = newTest();
    const { me, paymentId } = await checkout(t);
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" });
    const mine = await me.query(api.billing.mine, {});
    expect(mine).toMatchObject({ plan: "pro", effectivePlan: "pro", status: "active", openPaymentId: null });
    expect(mine.limits).toEqual({ products: 50, photosPerProduct: 6, teamMembers: 0, features: ["allLooks", "featuredSections", "announcementBar", "shopFilters", "salesPromotions", "shopStats"] });
    const history = await me.query(api.billing.payments, { paginationOpts: { numItems: 10, cursor: null } });
    expect(history.page.map((p) => [p._id, p.status])).toEqual([[paymentId, "succeeded"]]);
  });
});

describe("reconcilePending", () => {
  test("open payments older than 7 days expire", async () => {
    const t = newTest();
    const { paymentId, shopId } = await checkout(t);
    vi.setSystemTime(Date.now() + 8 * DAY_MS);
    await t.mutation(internal.payments.core.reconcilePending, {});
    expect((await paymentOf(t, paymentId))?.status).toBe("expired");
    expect((await subOf(t, shopId))?.plan).toBe("free");
  });
});
