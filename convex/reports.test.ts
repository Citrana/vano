import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, newTest, productArgs, sellerWithShop, setSubscription, type T } from "./lib/test.utils";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 19, 12);

async function businessShop(t: T, email = "amani@shop.cd", slug = "chez-amani") {
  const { userId, shopId } = await sellerWithShop(t, email, { slug });
  await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: NOW + 60 * DAY });
  const me = as(t, userId);
  const bag = await me.mutation(api.products.create, await productArgs(t, { name: "Sac", price: 10_000, sizes: [], colors: [] }));
  const belt = await me.mutation(api.products.create, await productArgs(t, { name: "Ceinture", price: 2000, sizes: [], colors: [], category: "shoes" }));
  return { userId, shopId, me, bag, belt };
}
type Me = Awaited<ReturnType<typeof businessShop>>["me"];

const sell = (me: Me, productId: Id<"products">, soldAt: number, extra: Record<string, unknown> = {}) =>
  me.mutation(api.salesRecords.record, {
    productId,
    quantity: 1,
    finalUnitPrice: 10_000,
    source: "whatsapp" as const,
    soldAt,
    timeZone: "Africa/Kinshasa",
    ...extra,
  });

const report = async (me: Me, month: string) => {
  const r = await me.query(api.reports.month, { month });
  if (r.locked) throw new Error("locked");
  return r;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("monthly report", () => {
  test("totals, top products, days, sources and categories from confirmed sales", async () => {
    const t = newTest();
    const { me, bag, belt } = await businessShop(t);
    await sell(me, bag, Date.UTC(2026, 10, 3, 10), { quantity: 2, finalUnitPrice: 9000 });
    await sell(me, belt, Date.UTC(2026, 10, 3, 11), { finalUnitPrice: 2000, source: "inPerson" });
    const reversed = await sell(me, bag, Date.UTC(2026, 10, 4, 10));
    await me.mutation(api.salesRecords.reverse, { recordId: reversed, expectedVersion: 1 });

    const r = await report(me, "2026-11");
    expect(r.summary).toEqual({ count: 2, items: 3, revenue: 20_000, discounts: 2000, average: 10_000 });
    expect(r.topByRevenue.map((p) => p.name)).toEqual(["Sac", "Ceinture"]);
    expect(r.topByPieces[0]).toMatchObject({ name: "Sac", items: 2 });
    expect(r.byDay).toHaveLength(30);
    expect(r.byDay[2]).toEqual({ day: "2026-11-03", revenue: 20_000, sales: 2, items: 3 });
    expect(r.byDay[3].sales).toBe(0);
    expect(r.bySource.find((s) => s.key === "inPerson")).toMatchObject({ sales: 1, revenue: 2000 });
    expect(r.byCategory.map((c) => c.key)).toEqual(["clothes", "shoes"]);
    expect(r.firstMonth).toBe("2026-11");
  });

  test("months follow the shop's time zone", async () => {
    const t = newTest();
    const { me, bag } = await businessShop(t);
    // 23:30 UTC on 31 Oct = 00:30 on 1 Nov in Kinshasa (the shop's zone).
    await sell(me, bag, Date.UTC(2026, 9, 31, 23, 30));
    expect((await report(me, "2026-11")).summary.count).toBe(1);
    expect((await report(me, "2026-10")).summary.count).toBe(0);
  });

  test("comparison with the previous month", async () => {
    const t = newTest();
    const { me, bag } = await businessShop(t);
    await sell(me, bag, Date.UTC(2026, 9, 10, 12), { finalUnitPrice: 10_000 });
    await sell(me, bag, Date.UTC(2026, 10, 10, 12), { finalUnitPrice: 12_000 });
    const r = await report(me, "2026-11");
    expect(r.previous).toMatchObject({ revenue: 10_000, count: 1 });
    expect(r.changes.revenue).toEqual({ percent: 20, direction: "up" });
    expect(r.changes.count).toEqual({ percent: 0, direction: "same" });
    expect((await report(me, "2026-10")).changes.revenue).toEqual({ percent: null, direction: "up" });
  });

  test("edited or deleted products don't change past reports", async () => {
    const t = newTest();
    const { me, bag } = await businessShop(t);
    await sell(me, bag, Date.UTC(2026, 10, 5, 12));
    await me.mutation(api.products.update, {
      productId: bag,
      ...(await productArgs(t, { name: "Sac renommé", price: 1, sizes: [], colors: [] })),
    });
    await me.mutation(api.products.remove, { productId: bag });
    const r = await report(me, "2026-11");
    expect(r.summary.revenue).toBe(10_000);
    expect(r.topByRevenue[0]).toMatchObject({ name: "Sac", revenue: 10_000 });
    expect(r.topByRevenue[0].photoUrl).not.toBeNull();
  });

  test("WhatsApp taps of the month, apart from sales", async () => {
    const t = newTest();
    const { me, shopId } = await businessShop(t);
    await t.run(async (ctx) => {
      for (const [day, clicks] of [["2026-11-02", 4], ["2026-11-20", 3], ["2026-10-31", 50]] as const) {
        await ctx.db.insert("shopDailyStats", { shopId, day, shopViews: 0, productViews: 0, whatsappClicks: clicks });
      }
    });
    expect((await report(me, "2026-11")).taps).toBe(7);
  });

  test("an invalid month is refused", async () => {
    const t = newTest();
    const { me } = await businessShop(t);
    await expect(me.query(api.reports.month, { month: "2026-13" })).rejects.toThrow(/REPORT_INVALID/);
  });
});

describe("monthly report: plan and access", () => {
  test("Free, Pro and the trial see the lock (sales kept)", async () => {
    const t = newTest();
    const { me, shopId, bag } = await businessShop(t);
    await sell(me, bag, Date.UTC(2026, 10, 5, 12));
    for (const state of [
      { plan: "pro", status: "trialing" },
      { plan: "pro", status: "active" },
      { plan: "free", status: "free" },
    ] as const) {
      await setSubscription(t, shopId, { ...state, periodEnd: state.plan === "free" ? undefined : NOW + DAY });
      expect(await me.query(api.reports.month, { month: "2026-11" })).toEqual({ locked: true, kept: 1 });
    }
  });

  test("each seller only sees their own shop; signed out is refused", async () => {
    const t = newTest();
    const amani = await businessShop(t);
    const bea = await businessShop(t, "bea@shop.cd", "bea-bags");
    await sell(amani.me, amani.bag, Date.UTC(2026, 10, 5, 12));
    expect((await report(bea.me, "2026-11")).summary.count).toBe(0);
    await expect(t.query(api.reports.month, { month: "2026-11" })).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});
