import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { newTest, sellerWithShop, setSubscription, type T } from "./lib/test.utils";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const DAY = 86_400_000;
const subOf = (t: T, shopId: Id<"shops">) =>
  t.run((ctx) => ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique());
const logs = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());

const GRACE = 3 * DAY;

describe("billingJobs.expireDue", () => {
  test("trials and paid plans move to Free once the grace days are over; others stay", async () => {
    const t = newTest();
    const trial = await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
    const paid = await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
    const running = await sellerWithShop(t, "c@x.com", { slug: "shop-c" });
    const grace = await sellerWithShop(t, "d@x.com", { slug: "shop-d" });
    const now = Date.now();
    await setSubscription(t, trial.shopId, { plan: "pro", status: "trialing", periodEnd: now - GRACE - 1 });
    await setSubscription(t, paid.shopId, { plan: "business", status: "active", periodEnd: now - GRACE - DAY });
    await setSubscription(t, running.shopId, { plan: "pro", status: "active", periodEnd: now + DAY });
    // Ended two days ago: still in the grace days, keeps Business.
    await setSubscription(t, grace.shopId, { plan: "business", status: "active", periodEnd: now - 2 * DAY });

    expect(await t.mutation(internal.billingJobs.expireDue, {})).toBe(2);
    expect(await subOf(t, trial.shopId)).toMatchObject({ plan: "free", status: "free", source: "system" });
    expect((await subOf(t, trial.shopId))?.periodEnd).toBeUndefined();
    expect(await subOf(t, paid.shopId)).toMatchObject({ plan: "free", status: "expired" });
    expect(await subOf(t, running.shopId)).toMatchObject({ plan: "pro", status: "active" });
    expect(await subOf(t, grace.shopId)).toMatchObject({ plan: "business", status: "active" });

    const entries = await logs(t);
    expect(entries.map((e) => [e.action, e.actorEmail, e.details?.previousPlan]).sort()).toEqual([
      ["subscription.expired", "system", "business"],
      ["subscription.trialEnded", "system", "pro"],
    ]);
    // Running again finds nothing.
    expect(await t.mutation(internal.billingJobs.expireDue, {})).toBe(0);
    expect(await logs(t)).toHaveLength(2);
  });

  test("a new shop's trial ends after two months, then 3 grace days", async () => {
    const t = newTest();
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    const { shopId } = await sellerWithShop(t);
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
    expect(await t.mutation(internal.billingJobs.expireDue, {})).toBe(0);
    vi.setSystemTime(new Date("2026-03-13T11:00:00Z"));
    expect(await t.mutation(internal.billingJobs.expireDue, {})).toBe(0);
    expect((await subOf(t, shopId))?.status).toBe("trialing");
    vi.setSystemTime(new Date("2026-03-13T12:00:00Z"));
    expect(await t.mutation(internal.billingJobs.expireDue, {})).toBe(1);
    // Free starts when the grace days end; data is never touched.
    expect(await subOf(t, shopId)).toMatchObject({ status: "free", periodStart: Date.parse("2026-03-13T12:00:00Z") });
  });
});

describe("migrations.billingV1", () => {
  test("shops without a subscription get a fresh trial; existing ones are kept", async () => {
    const t = newTest();
    const kept = await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
    await setSubscription(t, kept.shopId, { plan: "business", status: "active", periodEnd: Date.now() + DAY });
    const legacy = await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
    await t.run(async (ctx) => {
      const sub = await ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", legacy.shopId)).unique();
      await ctx.db.delete("subscriptions", sub!._id);
    });

    expect(await t.mutation(internal.migrations.billingV1, {})).toBe("started");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await subOf(t, kept.shopId)).toMatchObject({ plan: "business", status: "active" });
    const fresh = await subOf(t, legacy.shopId);
    expect(fresh).toMatchObject({ plan: "pro", status: "trialing", source: "trial" });
    expect(fresh!.periodStart).toBe(Date.now());
    expect(await t.query(internal.migrations.billingV1Status, {})).toMatchObject({ status: "done" });
    expect(await t.mutation(internal.migrations.billingV1, {})).toBe("already_done");
  });
});
