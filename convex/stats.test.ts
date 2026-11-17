import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { as, insertUser, productArgs, sellerWithShop } from "./lib/test.utils";

const modules = import.meta.glob("./**/*.*s");
const setup = () => convexTest(schema, modules);

afterEach(() => {
  vi.useRealTimers();
});

async function shopWithProduct() {
  const t = setup();
  const { userId, shopId } = await sellerWithShop(t);
  const productId = await as(t, userId).mutation(api.products.create, await productArgs(t));
  return { t, me: as(t, userId), shopId, productId };
}

describe("stats.record*", () => {
  test("unknown or malformed ids are ignored", async () => {
    const t = setup();
    expect(await t.mutation(api.stats.recordShopView, { shopId: "garbage" })).toBe(false);
    expect(await t.mutation(api.stats.recordProductView, { productId: "garbage" })).toBe(false);
    expect(await t.mutation(api.stats.recordWhatsappClick, { productId: "garbage" })).toBe(false);
    expect(await t.run((ctx) => ctx.db.query("shopDailyStats").collect())).toEqual([]);
  });

  test("counts per day and summarizes today / 7 / 30 days", async () => {
    vi.useFakeTimers();
    const { t, me, shopId, productId } = await shopWithProduct();

    vi.setSystemTime(new Date("2026-11-01T10:00:00Z")); // 16 days ago
    await t.mutation(api.stats.recordShopView, { shopId });
    vi.setSystemTime(new Date("2026-11-14T10:00:00Z")); // 3 days ago
    await t.mutation(api.stats.recordShopView, { shopId });
    await t.mutation(api.stats.recordProductView, { productId });
    vi.setSystemTime(new Date("2026-11-17T09:00:00Z")); // today
    await t.mutation(api.stats.recordShopView, { shopId });
    await t.mutation(api.stats.recordShopView, { shopId });
    await t.mutation(api.stats.recordProductView, { productId });
    await t.mutation(api.stats.recordWhatsappClick, { productId });
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z")); // > 30 days ago
    await t.mutation(api.stats.recordShopView, { shopId });

    const summary = await me.query(api.stats.summary, { today: "2026-11-17" });
    expect(summary.today).toEqual({ shopViews: 2, productViews: 1, whatsappClicks: 1 });
    expect(summary.last7).toEqual({ shopViews: 3, productViews: 2, whatsappClicks: 1 });
    expect(summary.last30).toEqual({ shopViews: 4, productViews: 2, whatsappClicks: 1 });
    expect(summary.products).toEqual([{ productId, views: 2, whatsappClicks: 1 }]);
  });

  test("summary is scoped to the caller's shop and needs a shop", async () => {
    const { t, shopId } = await shopWithProduct();
    await t.mutation(api.stats.recordShopView, { shopId });
    const other = await sellerWithShop(t, "b@x.com", { slug: "other-shop" });
    const summary = await as(t, other.userId).query(api.stats.summary, { today: "2026-11-17" });
    expect(summary.last30.shopViews).toBe(0);
    const noShop = as(t, await insertUser(t, "c@x.com"));
    await expect(noShop.query(api.stats.summary, { today: "2026-11-17" })).rejects.toThrow(/NO_SHOP/);
    await expect(t.query(api.stats.summary, { today: "2026-11-17" })).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});
