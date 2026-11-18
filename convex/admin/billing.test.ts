import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DAY_MS } from "../lib/plans";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  sellerWithShop,
  setSubscription,
  shopArgs,
  type T,
} from "../lib/test.utils";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const page = { numItems: 20, cursor: null };
const subOf = (t: T, shopId: Id<"shops">) =>
  t.run((ctx) => ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique());
const audit = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());

async function world(t: T) {
  const ids = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const viewer = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Billing viewer", ["billing.view"]));
  const amani = await sellerWithShop(t, "amani@shop.cd", { slug: "chez-amani", name: "Chez Amani" });
  const zawadi = await sellerWithShop(t, "zawadi@shop.ke", { slug: "zawadi", name: "Zawadi Shoes" });
  return { admin, viewer, amani, zawadi };
}

describe("admin.billing lists", () => {
  test("subscriptions: filter by plan, status, end date and search by shop name", async () => {
    const t = newTest();
    const w = await world(t);
    const now = Date.now();
    await setSubscription(t, w.zawadi.shopId, { plan: "business", status: "active", periodEnd: now + 40 * DAY_MS });
    const list = (args: object) =>
      as(t, w.viewer).query(api.admin.billing.subscriptions, { paginationOpts: page, ...args });

    expect((await list({})).page).toHaveLength(2);
    expect((await list({ plan: "business" })).page.map((s) => s.shopName)).toEqual(["Zawadi Shoes"]);
    expect((await list({ status: "trialing" })).page.map((s) => s.shopName)).toEqual(["Chez Amani"]);
    expect((await list({ plan: "pro", status: "active" })).page).toEqual([]);
    // Zawadi ends in 40 days, Amani's trial in about 61.
    expect((await list({ endsTo: now + 50 * DAY_MS })).page.map((s) => s.shopName)).toEqual(["Zawadi Shoes"]);
    expect((await list({ endsFrom: now + 50 * DAY_MS })).page.map((s) => s.shopName)).toEqual(["Chez Amani"]);
    expect((await list({ endsTo: now + 35 * DAY_MS, status: "active" })).page).toEqual([]);
    expect((await list({ search: "zawadi" })).page.map((s) => s.shopName)).toEqual(["Zawadi Shoes"]);
    expect((await list({ search: "amani", plan: "business" })).page).toEqual([]);
  });

  test("payments: filter by plan, status, date and search", async () => {
    const t = newTest();
    const w = await world(t);
    await t.run(async (ctx) => {
      const base = { userId: w.amani.userId, currency: "KES" as const, provider: "mock" as const };
      await ctx.db.insert("payments", { ...base, shopId: w.amani.shopId, shopName: "Chez Amani", plan: "pro", amountMinor: 29900, status: "succeeded" });
      await ctx.db.insert("payments", { ...base, shopId: w.zawadi.shopId, shopName: "Zawadi Shoes", plan: "business", amountMinor: 100000, status: "failed" });
    });
    const list = (args: object) => as(t, w.viewer).query(api.admin.billing.payments, { paginationOpts: page, ...args });
    expect((await list({})).page.map((p) => p.shopName)).toEqual(["Zawadi Shoes", "Chez Amani"]);
    expect((await list({ status: "failed" })).page.map((p) => p.plan)).toEqual(["business"]);
    expect((await list({ plan: "pro", status: "succeeded" })).page).toHaveLength(1);
    expect((await list({ plan: "pro" })).page).toHaveLength(1);
    expect((await list({ from: Date.now() + 1 })).page).toEqual([]);
    expect((await list({ search: "amani" })).page.map((p) => p.plan)).toEqual(["pro"]);
  });

  test("forShop shows the plan and recent payments; null for a bad id", async () => {
    const t = newTest();
    const w = await world(t);
    const panel = await as(t, w.viewer).query(api.admin.billing.forShop, { shopId: w.amani.shopId });
    expect(panel).toMatchObject({ plan: "pro", status: "trialing", source: "trial", payments: [] });
    expect(await as(t, w.viewer).query(api.admin.billing.forShop, { shopId: "nope" })).toBeNull();
  });

  test("needs billing.view; sellers are refused", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(as(t, w.amani.userId).query(api.admin.billing.subscriptions, { paginationOpts: page })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.amani.userId).query(api.admin.billing.payments, { paginationOpts: page })).rejects.toThrow(/FORBIDDEN/);
    await expect(t.query(api.admin.billing.forShop, { shopId: w.amani.shopId })).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});

describe("admin.billing.grant / extend", () => {
  test("grant puts the shop on the plan for N days and logs who, why and what changed", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.billing.grant, {
      shopId: w.amani.shopId,
      plan: "enterprise",
      days: 90,
      reason: "  Partner programme  ",
    });
    const sub = await subOf(t, w.amani.shopId);
    expect(sub).toMatchObject({ plan: "enterprise", status: "active", source: "admin", periodEnd: Date.now() + 90 * DAY_MS });
    const [log] = await audit(t);
    expect(log).toMatchObject({
      action: "subscription.grant",
      actorId: w.admin,
      targetType: "subscription",
      targetId: w.amani.shopId,
      targetLabel: "Chez Amani",
      details: { plan: "enterprise", days: 90, reason: "Partner programme", previousPlan: "pro", periodEnd: "2027-02-16", previousEnd: "2027-01-18" },
    });
  });

  test("extend adds days to the current end; Free has nothing to extend", async () => {
    const t = newTest();
    const w = await world(t);
    const before = (await subOf(t, w.amani.shopId))!.periodEnd!;
    await as(t, w.admin).mutation(api.admin.billing.extend, { shopId: w.amani.shopId, days: 10, reason: "Support delay" });
    expect((await subOf(t, w.amani.shopId))!.periodEnd).toBe(before + 10 * DAY_MS);
    expect((await audit(t)).map((l) => l.action)).toEqual(["subscription.extend"]);

    await setSubscription(t, w.zawadi.shopId, { plan: "free", status: "free" });
    await expect(
      as(t, w.admin).mutation(api.admin.billing.extend, { shopId: w.zawadi.shopId, days: 10, reason: "Support delay" }),
    ).rejects.toThrow(/PLAN_INVALID/);
  });

  test("reason and days are required and bounded", async () => {
    const t = newTest();
    const w = await world(t);
    const grant = (days: number, reason: string) =>
      as(t, w.admin).mutation(api.admin.billing.grant, { shopId: w.amani.shopId, plan: "pro", days, reason });
    await expect(grant(30, "   ")).rejects.toThrow(/REASON_INVALID/);
    await expect(grant(0, "Partner programme")).rejects.toThrow(/DAYS_INVALID/);
    await expect(grant(400, "Partner programme")).rejects.toThrow(/DAYS_INVALID/);
    expect(await audit(t)).toEqual([]);
  });

  test("needs billing.manage, never on your own shop", async () => {
    const t = newTest();
    const w = await world(t);
    const args = { shopId: w.amani.shopId, plan: "pro" as const, days: 30, reason: "Partner programme" };
    await expect(as(t, w.viewer).mutation(api.admin.billing.grant, args)).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.amani.userId).mutation(api.admin.billing.grant, args)).rejects.toThrow(/FORBIDDEN/);

    const ownShop = await as(t, w.admin).mutation(api.shops.create, shopArgs({ slug: "boss-shop" }));
    await expect(as(t, w.admin).mutation(api.admin.billing.grant, { ...args, shopId: ownShop })).rejects.toThrow(/CANNOT_MODIFY_SELF/);
    await expect(
      as(t, w.admin).mutation(api.admin.billing.extend, { shopId: ownShop, days: 5, reason: "Partner programme" }),
    ).rejects.toThrow(/CANNOT_MODIFY_SELF/);
  });

  test("deleting a shop removes its subscription but keeps its payments", async () => {
    const t = newTest();
    const w = await world(t);
    await t.run((ctx) =>
      ctx.db.insert("payments", {
        shopId: w.amani.shopId, shopName: "Chez Amani", userId: w.amani.userId, plan: "pro",
        amountMinor: 29900, currency: "KES", provider: "mock", status: "succeeded",
      }),
    );
    await as(t, w.admin).mutation(api.admin.shops.remove, { shopId: w.amani.shopId });
    expect(await subOf(t, w.amani.shopId)).toBeNull();
    expect((await as(t, w.viewer).query(api.admin.billing.payments, { paginationOpts: page })).page).toHaveLength(1);
  });
});
