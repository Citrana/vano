import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, newTest, productArgs, sellerWithShop, setSubscription, type T } from "./lib/test.utils";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 19, 12);

const display = { countdown: true, badge: true, label: true };

async function shopWithProducts(t: T, email = "amani@shop.cd", slug = "chez-amani") {
  const { userId, shopId } = await sellerWithShop(t, email, { slug });
  const me = as(t, userId);
  const dress = await me.mutation(api.products.create, await productArgs(t, { name: "Robe", price: 2500 }));
  const bag = await me.mutation(api.products.create, await productArgs(t, { name: "Sac", price: 10_000, category: "clothes" }));
  return { userId, shopId, me, dress, bag, slug };
}

function saleArgs(overrides: Record<string, unknown> = {}) {
  return {
    name: "Black Friday",
    discount: { kind: "percent" as const, value: 30 },
    target: { kind: "shop" as const, excludedIds: [] as Id<"products">[] },
    endsAt: NOW + 2 * DAY,
    display,
    steepConfirmed: false,
    ...overrides,
  };
}

async function publicPrices(t: T, slug: string) {
  const page = await t.query(api.public.shopBySlug, { slug });
  if (!page || page.suspended) throw new Error("no shop");
  return Object.fromEntries(page.products.map((p) => [p.name, { price: p.price, sale: p.sale?.price ?? null }]));
}

const saleRow = (t: T, id: Id<"sales">) => t.run((ctx) => ctx.db.get("sales", id));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("sales: create and show", () => {
  test("a running sale shows the sale price; the real price never changes", async () => {
    const t = newTest();
    const { me, slug, dress } = await shopWithProducts(t);
    await me.mutation(api.sales.create, saleArgs());
    expect(await publicPrices(t, slug)).toEqual({ Robe: { price: 2500, sale: 1750 }, Sac: { price: 10_000, sale: 7000 } });
    const product = await t.run((ctx) => ctx.db.get("products", dress));
    expect(product?.price).toBe(2500);
    const page = await t.query(api.public.productForPage, { slug, productId: dress });
    expect(page && !page.suspended && page.product.sale).toMatchObject({
      price: 1750,
      original: 2500,
      percent: 30,
      endsAt: NOW + 2 * DAY,
      badge: true,
      label: true,
      countdown: true,
    });
  });

  test("editing the product's normal price during a sale keeps the sale on the new price", async () => {
    const t = newTest();
    const { me, slug, dress } = await shopWithProducts(t);
    await me.mutation(api.sales.create, saleArgs());
    await me.mutation(api.products.update, { productId: dress, ...(await productArgs(t, { name: "Robe", price: 4000 })) });
    expect((await publicPrices(t, slug)).Robe).toEqual({ price: 4000, sale: 2800 });
  });

  test("the order button's live price follows the server (WhatsApp price at tap time)", async () => {
    const t = newTest();
    const { me, dress } = await shopWithProducts(t);
    expect(await t.query(api.public.productPrice, { productId: dress })).toEqual({ price: 2500, soldOut: false, sale: null, codeField: false });
    const saleId = await me.mutation(api.sales.create, saleArgs());
    expect((await t.query(api.public.productPrice, { productId: dress }))?.sale?.price).toBe(1750);
    await me.mutation(api.sales.pause, { saleId });
    expect((await t.query(api.public.productPrice, { productId: dress }))?.sale).toBeNull();
    expect(await t.query(api.public.productPrice, { productId: "nope" })).toBeNull();
  });

  test("validation: percent range, set price lower than normal, steep confirmation, dates, name", async () => {
    const t = newTest();
    const { me, dress } = await shopWithProducts(t);
    await expect(me.mutation(api.sales.create, saleArgs({ discount: { kind: "percent", value: 95 } }))).rejects.toThrow(
      /SALE_DISCOUNT_INVALID/,
    );
    await expect(
      me.mutation(api.sales.create, saleArgs({ discount: { kind: "price", value: 3000 }, target: { kind: "products", productIds: [dress] } })),
    ).rejects.toThrow(/SALE_DISCOUNT_INVALID/);
    await expect(me.mutation(api.sales.create, saleArgs({ discount: { kind: "amount", value: 50_000 } }))).rejects.toThrow(
      /SALE_NO_PRODUCTS/,
    );
    await expect(me.mutation(api.sales.create, saleArgs({ discount: { kind: "percent", value: 85 } }))).rejects.toThrow(
      /SALE_STEEP_UNCONFIRMED/,
    );
    await me.mutation(api.sales.create, saleArgs({ discount: { kind: "percent", value: 85 }, steepConfirmed: true }));
    await expect(me.mutation(api.sales.create, saleArgs({ endsAt: NOW - 1 }))).rejects.toThrow(/SALE_SCHEDULE_INVALID/);
    await expect(me.mutation(api.sales.create, saleArgs({ endsAt: NOW + 100 * DAY }))).rejects.toThrow(/SALE_SCHEDULE_INVALID/);
    await expect(me.mutation(api.sales.create, saleArgs({ name: " x " }))).rejects.toThrow(/SALE_NAME_INVALID/);
  });

  test("a category / whole-shop sale skips products it doesn't lower; exclusions keep the normal price", async () => {
    const t = newTest();
    const { me, slug, bag } = await shopWithProducts(t);
    // $30 off: the $25 dress can't go lower, the $100 bag can.
    await me.mutation(api.sales.create, saleArgs({ discount: { kind: "amount", value: 3000 } }));
    expect(await publicPrices(t, slug)).toEqual({ Robe: { price: 2500, sale: null }, Sac: { price: 10_000, sale: 7000 } });
    await me.mutation(api.sales.create, saleArgs({ name: "No bag", discount: { kind: "percent", value: 10 }, target: { kind: "shop", excludedIds: [bag] } }));
    expect((await publicPrices(t, slug)).Robe.sale).toBe(2250);
  });
});

describe("sales: overlapping", () => {
  test("the best price for the customer wins, and the seller is told", async () => {
    const t = newTest();
    const { me, slug, dress } = await shopWithProducts(t);
    await me.mutation(api.sales.create, saleArgs({ name: "Ten", discount: { kind: "percent", value: 10 } }));
    await me.mutation(api.sales.create, saleArgs({ name: "Set", discount: { kind: "price", value: 1500 }, target: { kind: "products", productIds: [dress] } }));
    expect(await publicPrices(t, slug)).toEqual({ Robe: { price: 2500, sale: 1500 }, Sac: { price: 10_000, sale: 9000 } });
    const list = await me.query(api.sales.listMine, {});
    expect(list.sales.map((s) => s.overlaps)).toEqual([1, 1]);
  });
});

describe("sales: schedule (server time, no browser clock)", () => {
  test("a scheduled sale starts and ends by itself, with notifications", async () => {
    const t = newTest();
    const { userId, me, slug } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs({ startsAt: NOW + HOUR, endsAt: NOW + HOUR + 2 * DAY }));
    expect((await saleRow(t, saleId))?.live).toBe(false);
    expect((await publicPrices(t, slug)).Robe.sale).toBeNull();

    vi.advanceTimersByTime(HOUR);
    await t.finishInProgressScheduledFunctions();
    expect((await saleRow(t, saleId))?.live).toBe(true);
    expect((await publicPrices(t, slug)).Robe.sale).toBe(1750);

    vi.advanceTimersByTime(DAY);
    await t.finishInProgressScheduledFunctions();
    vi.advanceTimersByTime(DAY);
    await t.finishInProgressScheduledFunctions();
    expect((await saleRow(t, saleId))?.live).toBe(false);
    expect((await publicPrices(t, slug)).Robe.sale).toBeNull();

    const inbox = await as(t, userId).query(api.notifications.inbox.latest, {});
    expect(inbox.map((n) => n.data.type).sort()).toEqual(["sale.ended", "sale.endingSoon", "sale.started"]);
  });

  test("a job left over from older dates changes nothing and sends nothing", async () => {
    const t = newTest();
    const { userId, me } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs({ endsAt: NOW + 2 * HOUR }));
    const sale = (await saleRow(t, saleId))!;
    // Moved the end later: the old end job still fires at +2h.
    await me.mutation(api.sales.update, { saleId, expectedVersion: sale.version, ...saleArgs({ endsAt: NOW + 2 * DAY }) });
    vi.advanceTimersByTime(2 * HOUR);
    await t.finishInProgressScheduledFunctions();
    expect((await saleRow(t, saleId))?.live).toBe(true);
    expect(await as(t, userId).query(api.notifications.inbox.latest, {})).toEqual([]);
  });

  test("the hourly sweep switches off a sale left live after its end", async () => {
    const t = newTest();
    const { me } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs({ endsAt: NOW + HOUR }));
    await t.run((ctx) => ctx.db.patch("sales", saleId, { endsAt: NOW - 1 })); // a job that never ran
    await t.mutation(internal.saleJobs.sweep, {});
    expect((await saleRow(t, saleId))?.live).toBe(false);
  });
});

describe("sales: pause, resume, duplicate, delete", () => {
  test("pause stops the sale at once; resume brings it back", async () => {
    const t = newTest();
    const { me, slug } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs());
    await me.mutation(api.sales.pause, { saleId });
    expect((await publicPrices(t, slug)).Robe.sale).toBeNull();
    await me.mutation(api.sales.resume, { saleId });
    expect((await publicPrices(t, slug)).Robe.sale).toBe(1750);
  });

  test("duplicate makes a paused copy; an ended sale's copy starts now", async () => {
    const t = newTest();
    const { me } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs({ endsAt: NOW + DAY }));
    vi.advanceTimersByTime(2 * DAY);
    await t.finishInProgressScheduledFunctions();
    const copyId = await me.mutation(api.sales.duplicate, { saleId, name: "Black Friday (copy)" });
    const copy = await saleRow(t, copyId);
    expect(copy).toMatchObject({ paused: true, live: false, startsAt: NOW + 2 * DAY, endsAt: NOW + 3 * DAY });
  });

  test("delete removes the sale and its numbers; products don't change", async () => {
    const t = newTest();
    const { me, dress } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs());
    await t.mutation(api.stats.recordWhatsappClick, { productId: dress });
    await me.mutation(api.sales.remove, { saleId });
    expect(await saleRow(t, saleId)).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("saleDailyStats").take(5))).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get("products", dress)))?.price).toBe(2500);
  });

  test("two edits at once: the second one, from an older version, is refused", async () => {
    const t = newTest();
    const { me } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs());
    const { version } = (await saleRow(t, saleId))!;
    await me.mutation(api.sales.update, { saleId, expectedVersion: version, ...saleArgs({ name: "Phone A" }) });
    await expect(
      me.mutation(api.sales.update, { saleId, expectedVersion: version, ...saleArgs({ name: "Phone B" }) }),
    ).rejects.toThrow(/SALE_STALE/);
    expect((await saleRow(t, saleId))?.name).toBe("Phone A");
  });
});

describe("sales: products deleted, hidden or sold out", () => {
  test("a deleted product leaves the sale; a hidden one isn't shown; a sold-out one keeps its sale price", async () => {
    const t = newTest();
    const { me, slug, dress, bag } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs({ target: { kind: "products", productIds: [dress, bag] } }));
    await me.mutation(api.products.remove, { productId: bag });
    const sale = await saleRow(t, saleId);
    expect(sale?.target).toEqual({ kind: "products", productIds: [dress] });
    await me.mutation(api.products.setSoldOut, { productId: dress, soldOut: true });
    expect((await publicPrices(t, slug)).Robe.sale).toBe(1750);
    await t.run((ctx) => ctx.db.patch("products", dress, { hidden: true }));
    expect(await publicPrices(t, slug)).toEqual({});
    expect(await t.query(api.public.productPrice, { productId: dress })).toBeNull();
  });
});

describe("sales: plan", () => {
  test("Free shops can't create, edit, duplicate or resume, but can pause and delete", async () => {
    const t = newTest();
    const { me, shopId } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs());
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    await expect(me.mutation(api.sales.create, saleArgs())).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
    const { version } = (await saleRow(t, saleId))!;
    await expect(me.mutation(api.sales.update, { saleId, expectedVersion: version, ...saleArgs() })).rejects.toThrow(
      /PLAN_FEATURE_LOCKED/,
    );
    await expect(me.mutation(api.sales.duplicate, { saleId, name: "Copy" })).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
    await me.mutation(api.sales.pause, { saleId });
    await expect(me.mutation(api.sales.resume, { saleId })).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
    expect((await me.query(api.sales.listMine, {})).entitled).toBe(false);
    await me.mutation(api.sales.remove, { saleId });
  });

  test("after a downgrade, running sales stop showing and normal prices return; the sale is kept", async () => {
    const t = newTest();
    const { me, shopId, slug, dress } = await shopWithProducts(t);
    const saleId = await me.mutation(api.sales.create, saleArgs());
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    expect(await publicPrices(t, slug)).toEqual({ Robe: { price: 2500, sale: null }, Sac: { price: 10_000, sale: null } });
    expect((await t.query(api.public.productPrice, { productId: dress }))?.sale).toBeNull();
    expect(await saleRow(t, saleId)).toMatchObject({ live: true });
    // Back on Pro: the sale shows again.
    await setSubscription(t, shopId, { plan: "pro", status: "active", periodEnd: NOW + 30 * DAY });
    expect((await publicPrices(t, slug)).Robe.sale).toBe(1750);
  });
});

describe("sales: ownership and access", () => {
  test("another seller's sale is NOT_FOUND; their products can't be targeted", async () => {
    const t = newTest();
    const a = await shopWithProducts(t);
    const b = await shopWithProducts(t, "baraka@shop.cd", "chez-baraka");
    const saleId = await a.me.mutation(api.sales.create, saleArgs());
    const { version } = (await saleRow(t, saleId))!;
    await expect(b.me.mutation(api.sales.update, { saleId, expectedVersion: version, ...saleArgs() })).rejects.toThrow(/NOT_FOUND/);
    await expect(b.me.mutation(api.sales.pause, { saleId })).rejects.toThrow(/NOT_FOUND/);
    await expect(b.me.mutation(api.sales.remove, { saleId })).rejects.toThrow(/NOT_FOUND/);
    await expect(b.me.mutation(api.sales.duplicate, { saleId, name: "Mine" })).rejects.toThrow(/NOT_FOUND/);
    expect((await b.me.query(api.sales.editor, { saleId })).sale).toBeNull();
    expect((await b.me.query(api.sales.listMine, {})).sales).toEqual([]);
    await expect(
      b.me.mutation(api.sales.create, saleArgs({ target: { kind: "products", productIds: [a.dress] } })),
    ).rejects.toThrow(/NOT_FOUND/);
  });

  test("signed out and suspended shops are refused", async () => {
    const t = newTest();
    const { me, shopId } = await shopWithProducts(t);
    await expect(t.query(api.sales.listMine, {})).rejects.toThrow(/NOT_AUTHENTICATED/);
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    await expect(me.mutation(api.sales.create, saleArgs())).rejects.toThrow(/SHOP_SUSPENDED/);
  });
});

describe("sales: stats", () => {
  test("views and WhatsApp clicks on sale items are counted per sale", async () => {
    const t = newTest();
    const { me, dress, bag } = await shopWithProducts(t);
    await me.mutation(api.sales.create, saleArgs({ target: { kind: "products", productIds: [dress] } }));
    await t.mutation(api.stats.recordProductView, { productId: dress });
    await t.mutation(api.stats.recordProductView, { productId: dress });
    await t.mutation(api.stats.recordWhatsappClick, { productId: dress });
    await t.mutation(api.stats.recordProductView, { productId: bag }); // not on sale
    const [sale] = (await me.query(api.sales.listMine, {})).sales;
    expect(sale).toMatchObject({ views: 2, whatsappClicks: 1, products: 1 });
  });
});
