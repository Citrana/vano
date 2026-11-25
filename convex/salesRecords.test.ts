import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  productArgs,
  sellerWithShop,
  setSubscription,
  storeFile,
  type T,
} from "./lib/test.utils";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 19, 12);

async function businessShop(t: T, email = "amani@shop.cd", slug = "chez-amani") {
  const { userId, shopId } = await sellerWithShop(t, email, { slug });
  await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: NOW + 60 * DAY });
  const me = as(t, userId);
  // A dress with sizes and a colour; a plain bag with no options.
  const dress = await me.mutation(api.products.create, await productArgs(t, { name: "Robe", price: 2500 }));
  const bag = await me.mutation(api.products.create, await productArgs(t, { name: "Sac", price: 10_000, sizes: [], colors: [] }));
  return { userId, shopId, me, dress, bag };
}

type Me = Awaited<ReturnType<typeof businessShop>>["me"];

function recordArgs(productId: Id<"products">, overrides: Record<string, unknown> = {}) {
  return {
    productId,
    quantity: 1,
    finalUnitPrice: 10_000,
    source: "whatsapp" as const,
    soldAt: NOW - HOUR,
    markSoldOut: true,
    ...overrides,
  };
}

const dressSale = (productId: Id<"products">, overrides: Record<string, unknown> = {}) =>
  recordArgs(productId, { size: "M", color: "Rouge", finalUnitPrice: 2500, markSoldOut: false, ...overrides });

const recordRow = (t: T, id: Id<"salesRecords">) => t.run((ctx) => ctx.db.get("salesRecords", id));
const productRow = (t: T, id: Id<"products">) => t.run((ctx) => ctx.db.get("products", id));
const events = (t: T, productId: Id<"products">) =>
  t.run(async (ctx) =>
    (
      await ctx.db
        .query("productEvents")
        .withIndex("by_productId_and_at", (q) => q.eq("productId", productId))
        .collect()
    ).map((e) => e.kind),
  );
const list = (me: Me, extra: Record<string, unknown> = {}) =>
  me.query(api.salesRecords.listMine, { from: "2026-11-01", to: "2026-11-30", ...extra });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("recorded sales: snapshot", () => {
  test("a sale keeps the product as it was, whatever happens to it later", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    const id = await me.mutation(api.salesRecords.record, dressSale(dress, { quantity: 2, finalUnitPrice: 2000 }));
    const before = await recordRow(t, id);
    const product = (await productRow(t, dress))!;
    expect(before).toMatchObject({
      productName: "Robe",
      photoId: product.imageIds[0],
      category: "clothes",
      size: "M",
      color: "Rouge",
      currency: "USD",
      normalUnitPrice: 2500,
      finalUnitPrice: 2000,
      quantity: 2,
      total: 4000,
      discount: 1000,
      source: "whatsapp",
      status: "recorded",
      day: "2026-11-19",
    });

    // Rename, reprice and re-photograph: the sale doesn't move.
    const newPhoto = await storeFile(t);
    await me.mutation(api.products.update, {
      productId: dress,
      ...(await productArgs(t, { name: "Robe longue", price: 9900, imageIds: [newPhoto] })),
    });
    expect(await recordRow(t, id)).toMatchObject({ productName: "Robe", normalUnitPrice: 2500, photoId: product.imageIds[0] });
    // The old photo is kept for the sale (not deleted from storage).
    expect(await t.run((ctx) => ctx.db.system.get("_storage", product.imageIds[0]))).not.toBeNull();

    // Delete the product: the sale and its photo stay, the list still shows it.
    await me.mutation(api.products.remove, { productId: dress });
    expect(await recordRow(t, id)).toMatchObject({ productName: "Robe", total: 4000, status: "recorded" });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", product.imageIds[0]))).not.toBeNull();
    const page = await list(me);
    if (page.locked) throw new Error("locked");
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({ productName: "Robe", total: 4000 });
    expect(page.rows[0].photoUrl).not.toBeNull();
    const details = await me.query(api.salesRecords.get, { recordId: id });
    expect(details).toMatchObject({ productExists: false, canRestock: false });
    expect(await events(t, dress)).toEqual(["sold", "deleted"]);
  });

  test("the offer is recomputed on the server: running sale, or the seller's code", async () => {
    const t = newTest();
    const { me, bag } = await businessShop(t);
    await me.mutation(api.sales.create, {
      name: "Soldes",
      discount: { kind: "percent", value: 20 },
      target: { kind: "shop", excludedIds: [] },
      endsAt: NOW + 2 * DAY,
      display: { countdown: true, badge: true, label: true },
      steepConfirmed: false,
    });
    const quote = await me.query(api.salesRecords.quote, { productId: bag, now: NOW });
    expect(quote).toMatchObject({ locked: false, suggestedPrice: 8000, offer: { kind: "sale", percent: 20 }, defaultMarkSoldOut: true });

    await me.mutation(api.discountCodes.create, {
      code: "vip40",
      discount: { kind: "percent", value: 40 },
      target: { kind: "shop", excludedIds: [] },
      endsAt: NOW + 2 * DAY,
    });
    const withCode = await me.query(api.salesRecords.quote, { productId: bag, code: "vip40", now: NOW });
    expect(withCode).toMatchObject({ suggestedPrice: 6000, offer: { kind: "code", code: "VIP40", percent: 40 }, codeStatus: "applied" });
    const wrong = await me.query(api.salesRecords.quote, { productId: bag, code: "nope", now: NOW });
    expect(wrong).toMatchObject({ suggestedPrice: 8000, codeStatus: "invalid" });

    // The seller types a negotiated price; the offer is still remembered.
    const id = await me.mutation(api.salesRecords.record, recordArgs(bag, { code: "VIP40", finalUnitPrice: 5500 }));
    expect(await recordRow(t, id)).toMatchObject({
      offer: { kind: "code", code: "VIP40", percent: 40 },
      finalUnitPrice: 5500,
      discount: 4500,
    });
    // Recording never touches the product's real price or the code's uses.
    expect((await productRow(t, bag))!.price).toBe(10_000);
    const code = await t.run(async (ctx) => (await ctx.db.query("discountCodes").first())!);
    expect(code.uses).toBe(0);
  });

  test("options and values are checked again on the server", async () => {
    const t = newTest();
    const { me, dress, bag } = await businessShop(t);
    await expect(me.mutation(api.salesRecords.record, dressSale(dress, { size: undefined }))).rejects.toThrow(/SALES_RECORD_OPTION/);
    await expect(me.mutation(api.salesRecords.record, dressSale(dress, { size: "XXL" }))).rejects.toThrow(/SALES_RECORD_OPTION/);
    await expect(me.mutation(api.salesRecords.record, recordArgs(bag, { size: "M" }))).rejects.toThrow(/SALES_RECORD_OPTION/);
    await expect(me.mutation(api.salesRecords.record, recordArgs(bag, { quantity: 0 }))).rejects.toThrow(/SALES_RECORD_QUANTITY/);
    await expect(me.mutation(api.salesRecords.record, recordArgs(bag, { finalUnitPrice: 0 }))).rejects.toThrow(/SALES_RECORD_PRICE/);
    await expect(me.mutation(api.salesRecords.record, recordArgs(bag, { soldAt: NOW + DAY }))).rejects.toThrow(/SALES_RECORD_DATE/);
    await expect(me.mutation(api.salesRecords.record, recordArgs(bag, { customerPhone: "12" }))).rejects.toThrow(/SALES_RECORD_CUSTOMER/);
    await expect(me.mutation(api.salesRecords.record, recordArgs(bag, { timeZone: "Mars/Base" }))).rejects.toThrow(/TIME_ZONE_INVALID/);
    const id = await me.mutation(api.salesRecords.record, dressSale(dress, { size: "m", customerPhone: "0812 345 678", customerName: " Neema " }));
    expect(await recordRow(t, id)).toMatchObject({ size: "M", customerPhone: "+243812345678", customerName: "Neema" });
  });

  test("the day is in the shop's time zone; the first sale saves the browser's zone", async () => {
    const t = newTest();
    const { me, shopId, bag } = await businessShop(t);
    const lateUtc = Date.UTC(2026, 10, 18, 23, 30); // 00:30 on the 19th in Kinshasa
    const id = await me.mutation(api.salesRecords.record, recordArgs(bag, { soldAt: lateUtc, timeZone: "Africa/Kinshasa" }));
    expect(await recordRow(t, id)).toMatchObject({ day: "2026-11-19" });
    expect((await t.run((ctx) => ctx.db.get("shops", shopId)))!.timeZone).toBe("Africa/Kinshasa");
    // Once set, the browser's zone doesn't change it.
    await me.mutation(api.salesRecords.record, dressSale((await businessShopDress(t, shopId))!, { timeZone: "Asia/Tokyo" }));
    expect((await t.run((ctx) => ctx.db.get("shops", shopId)))!.timeZone).toBe("Africa/Kinshasa");
  });
});

async function businessShopDress(t: T, shopId: Id<"shops">) {
  return await t.run(async (ctx) => {
    const p = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
      .collect();
    return p.find((x) => x.name === "Robe")?._id;
  });
}

describe("recorded sales: the sold out switch", () => {
  test("on: the product becomes sold out, in its history, and the sale remembers it", async () => {
    const t = newTest();
    const { me, bag } = await businessShop(t);
    await me.mutation(api.products.setFewLeft, { productId: bag, fewLeft: true });
    const id = await me.mutation(api.salesRecords.record, recordArgs(bag));
    const product = (await productRow(t, bag))!;
    expect(product.soldOut).toBe(true);
    expect(product.fewLeft).toBeUndefined();
    expect(await recordRow(t, id)).toMatchObject({ markedSoldOut: true });
    expect(await events(t, bag)).toEqual(["sold", "soldOut"]);
  });

  test("off: the product stays on sale", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    const id = await me.mutation(api.salesRecords.record, dressSale(dress));
    expect((await productRow(t, dress))!.soldOut).toBe(false);
    expect(await recordRow(t, id)).toMatchObject({ markedSoldOut: false });
  });

  test("already sold out: nothing changes and the sale didn't mark it", async () => {
    const t = newTest();
    const { me, bag } = await businessShop(t);
    await me.mutation(api.products.setSoldOut, { productId: bag, soldOut: true });
    const id = await me.mutation(api.salesRecords.record, recordArgs(bag));
    expect(await recordRow(t, id)).toMatchObject({ markedSoldOut: false });
    expect(await events(t, bag)).toEqual(["soldOut", "sold"]);
  });
});

describe("product history", () => {
  test("switching sold out (switch or form) is recorded; repeating it isn't", async () => {
    const t = newTest();
    const { me, dress } = await businessShop(t);
    await me.mutation(api.products.setSoldOut, { productId: dress, soldOut: true });
    await me.mutation(api.products.setSoldOut, { productId: dress, soldOut: true });
    await me.mutation(api.products.update, { productId: dress, ...(await productArgs(t, { name: "Robe", soldOut: false })) });
    await me.mutation(api.products.update, { productId: dress, ...(await productArgs(t, { name: "Robe", soldOut: false })) });
    expect(await events(t, dress)).toEqual(["soldOut", "backOnSale"]);
    expect((await productRow(t, dress))!.backInStock).toBe(true);
    const history = await me.query(api.salesRecords.productHistory, { productId: dress });
    if (history.locked) throw new Error("locked");
    expect(history.events.map((e) => e.kind)).toEqual(["backOnSale", "soldOut"]);
  });
});

describe("recorded sales: edit and reverse", () => {
  test("edit recomputes the total, the discount and the day; stale versions are refused", async () => {
    const t = newTest();
    const { me, bag } = await businessShop(t);
    const id = await me.mutation(api.salesRecords.record, recordArgs(bag));
    await me.mutation(api.salesRecords.update, {
      recordId: id,
      expectedVersion: 1,
      finalUnitPrice: 9000,
      quantity: 3,
      soldAt: NOW - 3 * DAY,
    });
    expect(await recordRow(t, id)).toMatchObject({ total: 27_000, discount: 3000, quantity: 3, day: "2026-11-16", version: 2 });
    await expect(
      me.mutation(api.salesRecords.update, { recordId: id, expectedVersion: 1, finalUnitPrice: 1, quantity: 1, soldAt: NOW }),
    ).rejects.toThrow(/SALES_RECORD_STALE/);
    await expect(
      me.mutation(api.salesRecords.update, { recordId: id, expectedVersion: 2, finalUnitPrice: 1, quantity: 0, soldAt: NOW }),
    ).rejects.toThrow(/SALES_RECORD_QUANTITY/);
    expect(await events(t, bag)).toEqual(["sold", "soldOut", "saleEdited"]);
  });

  test("reverse: kept and listed, out of the totals, product back on sale only if asked", async () => {
    const t = newTest();
    const { me, bag, dress } = await businessShop(t);
    const keep = await me.mutation(api.salesRecords.record, dressSale(dress, { finalUnitPrice: 2000 }));
    const id = await me.mutation(api.salesRecords.record, recordArgs(bag));
    expect(await me.query(api.salesRecords.get, { recordId: id })).toMatchObject({ canRestock: true });

    await me.mutation(api.salesRecords.reverse, { recordId: id, expectedVersion: 1, restock: true });
    expect(await recordRow(t, id)).toMatchObject({ status: "reversed", reversedAt: NOW });
    expect(await productRow(t, bag)).toMatchObject({ soldOut: false, backInStock: true, restockedAt: NOW });
    expect(await events(t, bag)).toEqual(["sold", "soldOut", "saleReversed", "backOnSale"]);

    const page = await list(me);
    if (page.locked) throw new Error("locked");
    expect(page.rows.map((r) => r.status).sort()).toEqual(["recorded", "reversed"]);
    expect(page.totals).toEqual({ count: 1, items: 1, revenue: 2000, discounts: 500 });

    await expect(me.mutation(api.salesRecords.reverse, { recordId: id, expectedVersion: 2, restock: false })).rejects.toThrow(
      /SALES_RECORD_REVERSED/,
    );
    await expect(
      me.mutation(api.salesRecords.update, { recordId: id, expectedVersion: 2, finalUnitPrice: 1, quantity: 1, soldAt: NOW }),
    ).rejects.toThrow(/SALES_RECORD_REVERSED/);
    expect(keep).toBeTruthy();
  });

  test("reverse without restock, or when the seller already put it back, leaves the product", async () => {
    const t = newTest();
    const { me, bag } = await businessShop(t);
    const a = await me.mutation(api.salesRecords.record, recordArgs(bag));
    await me.mutation(api.salesRecords.reverse, { recordId: a, expectedVersion: 1, restock: false });
    expect((await productRow(t, bag))!.soldOut).toBe(true);

    await me.mutation(api.products.setSoldOut, { productId: bag, soldOut: false });
    const b = await me.mutation(api.salesRecords.record, recordArgs(bag));
    await me.mutation(api.products.setSoldOut, { productId: bag, soldOut: false });
    expect(await me.query(api.salesRecords.get, { recordId: b })).toMatchObject({ canRestock: false });
    await me.mutation(api.salesRecords.reverse, { recordId: b, expectedVersion: 1, restock: true });
    expect((await productRow(t, bag))!.soldOut).toBe(false);
  });
});

describe("recorded sales: the list", () => {
  test("days in the shop's zone (either bound), source, status, product, search, sort", async () => {
    const t = newTest();
    const { me, bag, dress } = await businessShop(t);
    await me.mutation(api.salesRecords.record, recordArgs(bag, { markSoldOut: false, source: "instagram", customerName: "Neema", soldAt: NOW - 2 * HOUR }));
    await me.mutation(api.salesRecords.record, dressSale(dress, { source: "inPerson", soldAt: NOW - HOUR }));
    const old = await me.mutation(api.salesRecords.record, dressSale(dress, { soldAt: Date.UTC(2026, 9, 30, 12) }));

    const rows = async (args: Record<string, unknown>) => {
      const page = await me.query(api.salesRecords.listMine, args);
      if (page.locked) throw new Error("locked");
      return page;
    };

    // Any date: every sale, newest first; `order: "asc"` flips it.
    expect((await rows({})).rows.map((r) => r.source)).toEqual(["inPerson", "instagram", "whatsapp"]);
    expect((await rows({ order: "asc" })).rows.map((r) => r.source)).toEqual(["whatsapp", "instagram", "inPerson"]);

    // Days: both bounds, or one alone.
    const november = await rows({ from: "2026-11-01", to: "2026-11-30" });
    expect(november.rows.map((r) => r.source)).toEqual(["inPerson", "instagram"]);
    expect(november.products.map((p) => p.name)).toEqual(["Robe", "Sac"]);
    expect(november.truncated).toBe(false);
    expect((await rows({ from: "2026-11-01" })).rows).toHaveLength(2);
    expect((await rows({ to: "2026-10-31" })).rows.map((r) => r._id)).toEqual([old]);

    const bySource = await rows({ source: "instagram" });
    expect(bySource.rows).toHaveLength(1);
    expect(bySource.totals.revenue).toBe(10_000);

    expect((await rows({ productId: dress })).rows).toHaveLength(2);
    expect((await rows({ search: "nee" })).rows.map((r) => r.customerName)).toEqual(["Neema"]);

    await me.mutation(api.salesRecords.reverse, { recordId: old, expectedVersion: 1, restock: false });
    expect((await rows({ status: "reversed" })).rows.map((r) => r._id)).toEqual([old]);
    const recorded = await rows({ status: "recorded" });
    expect(recorded.rows).toHaveLength(2);
    expect(recorded.totals.count).toBe(2);

    await expect(rows({ from: "2026-12-01", to: "2026-11-01" })).rejects.toThrow(/SALES_RECORD_INVALID/);
    await expect(rows({ from: "yesterday" })).rejects.toThrow(/SALES_RECORD_INVALID/);
  });
});

describe("recorded sales: plan", () => {
  test("Free, Pro and the trial can't record, edit or reverse; sales are kept and come back", async () => {
    const t = newTest();
    const { me, shopId, bag } = await businessShop(t);
    const id = await me.mutation(api.salesRecords.record, recordArgs(bag, { markSoldOut: false }));
    for (const state of [
      { plan: "pro", status: "trialing" },
      { plan: "pro", status: "active" },
      { plan: "free", status: "free" },
    ] as const) {
      await setSubscription(t, shopId, { ...state, periodEnd: state.plan === "free" ? undefined : NOW + DAY });
      await expect(me.mutation(api.salesRecords.record, recordArgs(bag))).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
      await expect(
        me.mutation(api.salesRecords.update, { recordId: id, expectedVersion: 1, finalUnitPrice: 1, quantity: 1, soldAt: NOW }),
      ).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
      await expect(me.mutation(api.salesRecords.reverse, { recordId: id, expectedVersion: 1, restock: false })).rejects.toThrow(
        /PLAN_FEATURE_LOCKED/,
      );
      expect(await list(me)).toEqual({ locked: true, kept: 1 });
      expect(await me.query(api.salesRecords.quote, { productId: bag, now: NOW })).toEqual({ locked: true });
      expect(await me.query(api.salesRecords.get, { recordId: id })).toBeNull();
    }
    expect(await recordRow(t, id)).not.toBeNull();
    await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: NOW + DAY });
    const back = await list(me);
    if (back.locked) throw new Error("locked");
    expect(back.rows).toHaveLength(1);
  });
});

describe("recorded sales: ownership and permissions", () => {
  test("another seller's sale or product is NOT_FOUND / null", async () => {
    const t = newTest();
    const amani = await businessShop(t);
    const bea = await businessShop(t, "bea@shop.cd", "bea-bags");
    const id = await amani.me.mutation(api.salesRecords.record, recordArgs(amani.bag));
    await expect(bea.me.mutation(api.salesRecords.record, recordArgs(amani.bag))).rejects.toThrow(/NOT_FOUND/);
    await expect(
      bea.me.mutation(api.salesRecords.update, { recordId: id, expectedVersion: 1, finalUnitPrice: 1, quantity: 1, soldAt: NOW }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(bea.me.mutation(api.salesRecords.reverse, { recordId: id, expectedVersion: 1, restock: true })).rejects.toThrow(/NOT_FOUND/);
    expect(await bea.me.query(api.salesRecords.get, { recordId: id })).toBeNull();
    await expect(bea.me.query(api.salesRecords.quote, { productId: amani.bag, now: NOW })).rejects.toThrow(/NOT_FOUND/);
    const beaList = await list(bea.me);
    if (beaList.locked) throw new Error("locked");
    expect(beaList.rows).toEqual([]);
  });

  test("signed out and suspended shops are refused", async () => {
    const t = newTest();
    const { me, shopId, bag } = await businessShop(t);
    await expect(t.mutation(api.salesRecords.record, recordArgs(bag))).rejects.toThrow(/NOT_AUTHENTICATED/);
    await expect(t.query(api.salesRecords.listMine, { from: "2026-11-01", to: "2026-11-30" })).rejects.toThrow(/NOT_AUTHENTICATED/);
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    await expect(me.mutation(api.salesRecords.record, recordArgs(bag))).rejects.toThrow(/SHOP_SUSPENDED/);
  });

  test("customer details only with ownCustomers.view; recording needs ownSales.manage", async () => {
    const t = newTest();
    const { userId, me, bag } = await businessShop(t);
    const id = await me.mutation(api.salesRecords.record, recordArgs(bag, { customerName: "Neema", customerPhone: "+243812345678" }));
    expect(await me.query(api.salesRecords.get, { recordId: id })).toMatchObject({ customerName: "Neema", customerPhone: "+243812345678" });

    await builtInRoles(t);
    const helper = await insertRole(t, "Helper", ["ownShop.manage", "ownProducts.manage", "ownSales.manage"]);
    await t.run((ctx) => ctx.db.patch("users", userId, { roleId: helper }));
    expect(await me.query(api.salesRecords.get, { recordId: id })).toMatchObject({ customerName: null, customerPhone: null });
    const page = await list(me, { search: "neema" });
    if (page.locked) throw new Error("locked");
    expect(page.rows).toEqual([]);
    expect(page.canSeeCustomers).toBe(false);

    const noSales = await insertRole(t, "Catalog", ["ownShop.manage", "ownProducts.manage"]);
    await t.run((ctx) => ctx.db.patch("users", userId, { roleId: noSales }));
    await expect(me.mutation(api.salesRecords.record, recordArgs(bag))).rejects.toThrow(/FORBIDDEN/);
    await expect(list(me)).rejects.toThrow(/FORBIDDEN/);
    expect(insertUserWithRole).toBeTypeOf("function");
  });
});
