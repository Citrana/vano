import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { addDays, utcDay } from "./days";
import { readPlatformStats } from "./platformStats";
import { as, newTest, productArgs, sellerWithShop } from "./test.utils";

describe("readPlatformStats", () => {
  test("is all zeros on an empty deployment", async () => {
    const t = newTest();
    expect(await t.run((ctx) => readPlatformStats(ctx, "2026-11-17"))).toEqual({
      totals: { users: 0, shops: 0, products: 0, whatsappClicks: 0 },
      last7: { signups: 0, shops: 0 },
      last30: { signups: 0, shops: 0 },
    });
  });
});

describe("platform counters follow every write", () => {
  const today = utcDay(Date.now());
  const stats = (t: ReturnType<typeof newTest>, day = today) =>
    t.run((ctx) => readPlatformStats(ctx, day));

  test("sign-up, shops, products and WhatsApp clicks", async () => {
    const t = newTest();
    // A real account creation (same path as sign-up) through the seed command.
    await t.action(internal.seed.superAdmin, { email: "boss@example.com", password: "password1" });
    expect((await stats(t)).totals.users).toBe(1);

    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    const p1 = await me.mutation(api.products.create, await productArgs(t));
    const p2 = await me.mutation(api.products.create, await productArgs(t));
    expect((await stats(t)).totals).toMatchObject({ shops: 1, products: 2 });

    await me.mutation(api.products.remove, { productId: p2 });
    expect((await stats(t)).totals.products).toBe(1);

    await t.mutation(api.stats.recordWhatsappClick, { productId: p1 });
    await t.mutation(api.stats.recordWhatsappClick, { productId: p1 });
    await t.mutation(api.stats.recordProductView, { productId: p1 });
    expect((await stats(t)).totals.whatsappClicks).toBe(2);
  });

  test("7- and 30-day windows only count what's inside them", async () => {
    const t = newTest();
    await sellerWithShop(t);
    // Created "now": inside both windows today, only the 30-day one 10 days on.
    expect((await stats(t)).last7.shops).toBe(1);
    expect((await stats(t, addDays(today, 10))).last7.shops).toBe(0);
    expect((await stats(t, addDays(today, 10))).last30.shops).toBe(1);
    expect((await stats(t, addDays(today, 40))).last30.shops).toBe(0);
    expect((await stats(t, "not-a-day")).last30.shops).toBe(0);
  });
});
