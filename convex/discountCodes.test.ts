import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, newTest, productArgs, sellerWithShop, setSubscription, type T } from "./lib/test.utils";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 19, 12);
const VISITOR = "visitor-aaaa-1111";

async function businessShop(t: T, email = "amani@shop.cd", slug = "chez-amani") {
  const { userId, shopId } = await sellerWithShop(t, email, { slug });
  await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: NOW + 60 * DAY });
  const me = as(t, userId);
  const dress = await me.mutation(api.products.create, await productArgs(t, { name: "Robe", price: 2500 }));
  const shoes = await me.mutation(api.products.create, await productArgs(t, { name: "Baskets", price: 10_000, category: "shoes" }));
  return { userId, shopId, me, dress, shoes, slug };
}

function codeArgs(overrides: Record<string, unknown> = {}) {
  return {
    code: "welcome10",
    discount: { kind: "percent" as const, value: 10 },
    target: { kind: "shop" as const, excludedIds: [] as Id<"products">[] },
    endsAt: NOW + 2 * DAY,
    ...overrides,
  };
}

const codeRow = (t: T, id: Id<"discountCodes">) => t.run((ctx) => ctx.db.get("discountCodes", id));
const check = (t: T, productId: Id<"products">, code: string, visitorId = VISITOR) =>
  t.mutation(api.public.checkDiscountCode, { productId, code, visitorId });
const redeem = (t: T, productId: Id<"products">, code: string, visitorId = VISITOR) =>
  t.mutation(api.public.redeemDiscountCode, { productId, code, visitorId });
const field = async (t: T, productId: Id<"products">) => (await t.query(api.public.productPrice, { productId }))?.codeField;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("discount codes: seller", () => {
  test("create stores the code upper case and lists it with its uses", async () => {
    const t = newTest();
    const { me } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs({ maxUses: 5 }));
    const row = await codeRow(t, id);
    expect(row).toMatchObject({ code: "WELCOME10", uses: 0, maxUses: 5, live: true, startsAt: NOW });
    const list = await me.query(api.discountCodes.listMine, {});
    expect(list.entitled).toBe(true);
    expect(list.codes).toHaveLength(1);
    expect(list.codes[0]).toMatchObject({ code: "WELCOME10", uses: 0, maxUses: 5, products: 2 });
  });

  test("the code is unique in the shop, not case sensitive; another shop may use it", async () => {
    const t = newTest();
    const { me } = await businessShop(t);
    await me.mutation(api.discountCodes.create, codeArgs());
    await expect(me.mutation(api.discountCodes.create, codeArgs({ code: "WELCOME10" }))).rejects.toThrow(/DISCOUNT_CODE_TAKEN/);
    const other = await businessShop(t, "neema@shop.cd", "chez-neema");
    await expect(other.me.mutation(api.discountCodes.create, codeArgs())).resolves.toBeDefined();
  });

  test("everything is checked on the server", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    const bad = (o: Record<string, unknown>) => me.mutation(api.discountCodes.create, codeArgs(o));
    await expect(bad({ code: "AB" })).rejects.toThrow(/DISCOUNT_CODE_INVALID/);
    await expect(bad({ code: "SALE-10" })).rejects.toThrow(/DISCOUNT_CODE_INVALID/);
    await expect(bad({ discount: { kind: "percent", value: 95 } })).rejects.toThrow(/DISCOUNT_CODE_DISCOUNT_INVALID/);
    await expect(bad({ endsAt: NOW - 1 })).rejects.toThrow(/DISCOUNT_CODE_SCHEDULE_INVALID/);
    await expect(bad({ startsAt: NOW + DAY, endsAt: NOW + HOUR })).rejects.toThrow(/DISCOUNT_CODE_SCHEDULE_INVALID/);
    await expect(bad({ maxUses: 0 })).rejects.toThrow(/DISCOUNT_CODE_MAX_USES_INVALID/);
    // 30.00 off a 25.00 dress: it isn't lowered.
    await expect(
      bad({ discount: { kind: "amount", value: 3000 }, target: { kind: "products", productIds: [dress] } }),
    ).rejects.toThrow(/DISCOUNT_CODE_DISCOUNT_INVALID/);
    await expect(
      bad({ target: { kind: "category", category: "bags", excludedIds: [] } }),
    ).rejects.toThrow(/DISCOUNT_CODE_NO_PRODUCTS/);
  });

  test("Free and Pro (and the Pro trial) can't create, edit or resume; pause and delete still work", async () => {
    const t = newTest();
    const { me, shopId } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs());
    for (const state of [
      { plan: "pro" as const, status: "trialing" as const, periodEnd: NOW + DAY },
      { plan: "pro" as const, status: "active" as const, periodEnd: NOW + DAY },
      { plan: "free" as const, status: "free" as const },
    ]) {
      await setSubscription(t, shopId, state);
      expect((await me.query(api.discountCodes.listMine, {})).entitled).toBe(false);
      await expect(me.mutation(api.discountCodes.create, codeArgs({ code: "OTHER" }))).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
      const { version } = (await codeRow(t, id))!;
      await expect(
        me.mutation(api.discountCodes.update, { codeId: id, expectedVersion: version, ...codeArgs() }),
      ).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
    }
    await me.mutation(api.discountCodes.pause, { codeId: id });
    await expect(me.mutation(api.discountCodes.resume, { codeId: id })).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
    await me.mutation(api.discountCodes.remove, { codeId: id });
    expect(await codeRow(t, id)).toBeNull();
  });

  test("edits send the version they started from", async () => {
    const t = newTest();
    const { me } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs());
    const { version } = (await codeRow(t, id))!;
    await me.mutation(api.discountCodes.update, { codeId: id, expectedVersion: version, ...codeArgs({ code: "summer20" }) });
    expect((await codeRow(t, id))?.code).toBe("SUMMER20");
    await expect(
      me.mutation(api.discountCodes.update, { codeId: id, expectedVersion: version, ...codeArgs() }),
    ).rejects.toThrow(/DISCOUNT_CODE_STALE/);
  });

  test("the maximum can't go below the uses already counted", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs({ maxUses: 5 }));
    await redeem(t, dress, "WELCOME10", "visitor-one-11111");
    await redeem(t, dress, "WELCOME10", "visitor-two-22222");
    const { version } = (await codeRow(t, id))!;
    await expect(
      me.mutation(api.discountCodes.update, { codeId: id, expectedVersion: version, ...codeArgs({ maxUses: 1 }) }),
    ).rejects.toThrow(/DISCOUNT_CODE_MAX_USES_INVALID/);
    await me.mutation(api.discountCodes.update, { codeId: id, expectedVersion: version, ...codeArgs({ maxUses: 2 }) });
    expect(await codeRow(t, id)).toMatchObject({ uses: 2, maxUses: 2, live: false });
  });

  test("another seller's code is NOT_FOUND; their products can't be targeted", async () => {
    const t = newTest();
    const a = await businessShop(t);
    const b = await businessShop(t, "neema@shop.cd", "chez-neema");
    const id = await a.me.mutation(api.discountCodes.create, codeArgs());
    const { version } = (await codeRow(t, id))!;
    await expect(b.me.mutation(api.discountCodes.update, { codeId: id, expectedVersion: version, ...codeArgs() })).rejects.toThrow(/NOT_FOUND/);
    await expect(b.me.mutation(api.discountCodes.pause, { codeId: id })).rejects.toThrow(/NOT_FOUND/);
    await expect(b.me.mutation(api.discountCodes.resume, { codeId: id })).rejects.toThrow(/NOT_FOUND/);
    await expect(b.me.mutation(api.discountCodes.remove, { codeId: id })).rejects.toThrow(/NOT_FOUND/);
    expect((await b.me.query(api.discountCodes.editor, { codeId: id })).code).toBeNull();
    await expect(
      b.me.mutation(api.discountCodes.create, codeArgs({ target: { kind: "products", productIds: [a.dress] } })),
    ).rejects.toThrow(/NOT_FOUND/);
  });

  test("signed out and suspended shops are refused", async () => {
    const t = newTest();
    const { me, shopId } = await businessShop(t);
    await expect(t.query(api.discountCodes.listMine, {})).rejects.toThrow(/NOT_AUTHENTICATED/);
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    await expect(me.mutation(api.discountCodes.create, codeArgs())).rejects.toThrow(/SHOP_SUSPENDED/);
  });

  test("deleting a product removes it from codes", async () => {
    const t = newTest();
    const { me, dress, shoes } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs({ target: { kind: "products", productIds: [dress, shoes] } }));
    await me.mutation(api.products.remove, { productId: dress });
    expect((await codeRow(t, id))?.target).toEqual({ kind: "products", productIds: [shoes] });
  });

  test("deleting a code deletes its uses", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs());
    await redeem(t, dress, "WELCOME10");
    await me.mutation(api.discountCodes.remove, { codeId: id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("discountCodeUses").take(10))).toHaveLength(0);
  });

  test("uses show in the shop stats", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    await me.mutation(api.discountCodes.create, codeArgs());
    await me.mutation(api.discountCodes.create, codeArgs({ code: "VIP" }));
    await redeem(t, dress, "VIP");
    const stats = await me.query(api.stats.summary, { today: "2026-11-19" });
    expect(!stats.locked && stats.discountCodes.map((c) => [c.code, c.uses])).toEqual([
      ["VIP", 1],
      ["WELCOME10", 0],
    ]);
  });
});

describe("discount codes: product page", () => {
  test("the field shows only on products a live code applies to", async () => {
    const t = newTest();
    const { me, dress, shoes, slug } = await businessShop(t);
    expect(await field(t, dress)).toBe(false);
    await me.mutation(api.discountCodes.create, codeArgs({ target: { kind: "category", category: "shoes", excludedIds: [] } }));
    expect(await field(t, shoes)).toBe(true);
    expect(await field(t, dress)).toBe(false);
    const page = await t.query(api.public.productForPage, { slug, productId: shoes });
    expect(page && !page.suspended && page.product.codeField).toBe(true);
  });

  test("a valid code: price computed by the server, real price untouched", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    await me.mutation(api.discountCodes.create, codeArgs());
    expect(await check(t, dress, " welcome10 ")).toEqual({
      status: "applied",
      code: "WELCOME10",
      price: 2250,
      original: 2500,
      percent: 10,
    });
    expect((await t.run((ctx) => ctx.db.get("products", dress)))?.price).toBe(2500);
  });

  test("results never leak the shop's owner or other codes", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    await me.mutation(api.discountCodes.create, codeArgs());
    const result = JSON.stringify(await check(t, dress, "WELCOME10"));
    expect(result).not.toMatch(/ownerId|shopId/);
    expect(Object.keys((await t.query(api.public.productPrice, { productId: dress }))!).sort()).toEqual(["codeField", "price", "sale", "soldOut"]);
  });

  test("scheduled, paused and ended codes", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs({ startsAt: NOW + HOUR, endsAt: NOW + 2 * HOUR }));
    expect(await field(t, dress)).toBe(false);
    expect((await check(t, dress, "WELCOME10")).status).toBe("notActive");

    vi.advanceTimersByTime(HOUR);
    await t.finishInProgressScheduledFunctions();
    expect((await codeRow(t, id))?.live).toBe(true);
    expect(await field(t, dress)).toBe(true);
    expect((await check(t, dress, "WELCOME10")).status).toBe("applied");

    await me.mutation(api.discountCodes.pause, { codeId: id });
    expect(await field(t, dress)).toBe(false);
    expect((await check(t, dress, "WELCOME10")).status).toBe("notActive");
    await me.mutation(api.discountCodes.resume, { codeId: id });
    expect((await check(t, dress, "WELCOME10")).status).toBe("applied");

    vi.advanceTimersByTime(HOUR);
    await t.finishInProgressScheduledFunctions();
    expect((await codeRow(t, id))?.live).toBe(false);
    expect(await field(t, dress)).toBe(false);
    expect((await check(t, dress, "WELCOME10")).status).toBe("ended");
  });

  test("the hourly sweep switches off a code left live after its end", async () => {
    const t = newTest();
    const { me } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs({ endsAt: NOW + HOUR }));
    vi.setSystemTime(NOW + 2 * HOUR);
    await t.mutation(internal.discountCodeJobs.sweep, {});
    expect((await codeRow(t, id))?.live).toBe(false);
  });

  test("a code for other products says so", async () => {
    const t = newTest();
    const { me, dress, shoes } = await businessShop(t);
    await me.mutation(api.discountCodes.create, codeArgs({ target: { kind: "products", productIds: [shoes] } }));
    expect((await check(t, dress, "WELCOME10")).status).toBe("notForProduct");
    expect((await check(t, dress, "NOPE123")).status).toBe("invalid");
  });

  test("sale + code: the customer gets the best price, never both", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    const display = { countdown: false, badge: true, label: false };
    const saleArgs = {
      name: "Sale",
      target: { kind: "shop" as const, excludedIds: [] },
      endsAt: NOW + DAY,
      display,
      steepConfirmed: false,
    };
    // Sale 30% off (17.50) vs code 10% off (22.50): the sale wins.
    const saleId = await me.mutation(api.sales.create, { ...saleArgs, discount: { kind: "percent", value: 30 } });
    await me.mutation(api.discountCodes.create, codeArgs());
    expect((await check(t, dress, "WELCOME10")).status).toBe("saleBetter");
    expect((await redeem(t, dress, "WELCOME10")).status).toBe("saleBetter");
    // Sale 5% off (23.75) vs code 10% off the real price (22.50): the code wins.
    await me.mutation(api.sales.remove, { saleId });
    await me.mutation(api.sales.create, { ...saleArgs, discount: { kind: "percent", value: 5 } });
    expect(await check(t, dress, "WELCOME10")).toMatchObject({ status: "applied", price: 2250, original: 2500 });
  });

  test("dropping below Business: codes stop, the field goes, the codes stay saved", async () => {
    const t = newTest();
    const { me, shopId, dress } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs());
    expect(await field(t, dress)).toBe(true);
    await setSubscription(t, shopId, { plan: "pro", status: "active", periodEnd: NOW + DAY });
    expect(await field(t, dress)).toBe(false);
    expect((await check(t, dress, "WELCOME10")).status).toBe("invalid");
    expect((await redeem(t, dress, "WELCOME10")).status).toBe("invalid");
    expect(await codeRow(t, id)).toMatchObject({ code: "WELCOME10", uses: 0 });
    // Back on Business: it works again.
    await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: NOW + DAY });
    expect((await check(t, dress, "WELCOME10")).status).toBe("applied");
  });
});

describe("discount codes: uses", () => {
  test("Order counts a use; checking never does; once per visitor and product", async () => {
    const t = newTest();
    const { me, dress, shoes } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs());
    await check(t, dress, "WELCOME10");
    expect((await codeRow(t, id))?.uses).toBe(0);
    expect(await redeem(t, dress, "WELCOME10")).toMatchObject({ status: "applied", price: 2250 });
    await redeem(t, dress, "WELCOME10");
    expect((await codeRow(t, id))?.uses).toBe(1);
    await redeem(t, shoes, "WELCOME10");
    await redeem(t, dress, "WELCOME10", "visitor-bbbb-2222");
    expect((await codeRow(t, id))?.uses).toBe(3);
  });

  test("the maximum is respected on the server", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    const id = await me.mutation(api.discountCodes.create, codeArgs({ maxUses: 2 }));
    expect((await redeem(t, dress, "WELCOME10", "visitor-one-11111")).status).toBe("applied");
    expect((await redeem(t, dress, "WELCOME10", "visitor-two-22222")).status).toBe("applied");
    expect(await codeRow(t, id)).toMatchObject({ uses: 2, live: false });
    expect((await redeem(t, dress, "WELCOME10", "visitor-three-333")).status).toBe("usedUp");
    expect((await check(t, dress, "WELCOME10", "visitor-three-333")).status).toBe("usedUp");
    expect(await field(t, dress)).toBe(false);
    // Someone who already ordered with it can tap Order again.
    expect((await redeem(t, dress, "WELCOME10", "visitor-one-11111")).status).toBe("applied");
    expect((await codeRow(t, id))?.uses).toBe(2);
    expect((await me.query(api.discountCodes.listMine, {})).codes[0]).toMatchObject({ uses: 2, maxUses: 2 });
  });
});

describe("discount codes: guessing limits", () => {
  test("a visitor gets a few wrong attempts, then has to wait", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    await me.mutation(api.discountCodes.create, codeArgs());
    for (let i = 0; i < 5; i++) expect((await check(t, dress, `WRONG${i}`)).status).toBe("invalid");
    expect((await check(t, dress, "WRONG9")).status).toBe("tooMany");
    // Even the right code waits (no free oracle), and so does Order.
    expect((await check(t, dress, "WELCOME10")).status).toBe("tooMany");
    expect((await redeem(t, dress, "WELCOME10")).status).toBe("tooMany");
    // Another visitor isn't blocked.
    expect((await check(t, dress, "WELCOME10", "visitor-bbbb-2222")).status).toBe("applied");
    // Tokens come back with time (10 an hour).
    vi.advanceTimersByTime(HOUR / 5);
    expect((await check(t, dress, "WELCOME10")).status).toBe("applied");
  });

  test("valid codes never count", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    await me.mutation(api.discountCodes.create, codeArgs());
    for (let i = 0; i < 12; i++) expect((await check(t, dress, "WELCOME10")).status).toBe("applied");
  });

  test("the shop has its own limit, so rotating visitor ids doesn't help", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    await me.mutation(api.discountCodes.create, codeArgs());
    for (let i = 0; i < 30; i++) {
      expect((await check(t, dress, `WRONG${i}`, `visitor-rot-${String(i).padStart(4, "0")}`)).status).toBe("invalid");
    }
    expect((await check(t, dress, "WELCOME10", "visitor-fresh-0001")).status).toBe("tooMany");
    // Another shop is not affected.
    const other = await businessShop(t, "neema@shop.cd", "chez-neema");
    await other.me.mutation(api.discountCodes.create, codeArgs());
    expect((await check(t, other.dress, "WELCOME10", "visitor-fresh-0001")).status).toBe("applied");
  });
});
