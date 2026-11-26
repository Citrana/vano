import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, builtInRoles, insertUserWithRole, newTest, productArgs, sellerWithShop, setSubscription, type T } from "./lib/test.utils";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 19, 12);
const VISITOR = "visitor-aaaa-1111";

async function shop(t: T, plan: "business" | "pro" = "business", email = "amani@shop.cd", slug = "chez-amani") {
  const { userId, shopId } = await sellerWithShop(t, email, { slug });
  await setSubscription(t, shopId, { plan, status: "active", periodEnd: NOW + 60 * DAY });
  return { userId, shopId, me: as(t, userId), slug };
}

const plain = async (t: T, overrides: Record<string, unknown> = {}) => ({
  ...(await productArgs(t, { name: "Sandales", price: 5000, sizes: [], colors: [] })),
  ...overrides,
});
const productRow = (t: T, id: Id<"products">) => t.run((ctx) => ctx.db.get("products", id));
const shopNames = async (t: T, slug: string) => {
  const page = await t.query(api.public.shopBySlug, { slug });
  if (!page || page.suspended) throw new Error("no shop");
  return page.products.map((p) => p.name);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("pieces in stock on the product form", () => {
  test("the count decides Few left and Sold out", async () => {
    const t = newTest();
    const { me } = await shop(t);
    const id = await me.mutation(api.products.create, await plain(t, { pieces: 2 }));
    expect(await productRow(t, id)).toMatchObject({ pieces: 2, fewLeft: true, soldOut: false });

    await me.mutation(api.products.update, { productId: id, ...(await plain(t, { pieces: 0 })) });
    expect(await productRow(t, id)).toMatchObject({ pieces: 0, soldOut: true });

    // Pieces again: back on sale, "Back in stock", no Few left above 3.
    await me.mutation(api.products.update, { productId: id, ...(await plain(t, { pieces: 10 })) });
    const product = (await productRow(t, id))!;
    expect(product).toMatchObject({ pieces: 10, soldOut: false, backInStock: true });
    expect(product.fewLeft).toBeUndefined();

    // The count wins over the form's switch while tracked.
    await me.mutation(api.products.update, { productId: id, ...(await plain(t, { pieces: 4, soldOut: true })) });
    expect(await productRow(t, id)).toMatchObject({ pieces: 4, soldOut: false });
  });

  test("the manual switches are refused while the count is tracked", async () => {
    const t = newTest();
    const { me } = await shop(t);
    const id = await me.mutation(api.products.create, await plain(t, { pieces: 5 }));
    await expect(me.mutation(api.products.setSoldOut, { productId: id, soldOut: true })).rejects.toThrow(/STOCK_TRACKED/);
    await expect(me.mutation(api.products.setFewLeft, { productId: id, fewLeft: true })).rejects.toThrow(/STOCK_TRACKED/);
    const list = await me.query(api.products.listMine, {});
    expect(list[0]).toMatchObject({ pieces: 5, tracked: true });
  });

  test("invalid counts are refused; a new product needs at least one piece", async () => {
    const t = newTest();
    const { me } = await shop(t);
    await expect(me.mutation(api.products.create, await plain(t, { pieces: -1 }))).rejects.toThrow(/STOCK_INVALID/);
    await expect(me.mutation(api.products.create, await plain(t, { pieces: 2.5 }))).rejects.toThrow(/STOCK_INVALID/);
    await expect(me.mutation(api.products.create, await plain(t, { pieces: 0 }))).rejects.toThrow(/STOCK_INVALID/);
    const id = await me.mutation(api.products.create, await plain(t, { pieces: 1 }));
    // 0 is fine on an edit: the product is sold out.
    await me.mutation(api.products.update, { productId: id, ...(await plain(t, { pieces: 0 })) });
    expect(await productRow(t, id)).toMatchObject({ pieces: 0, soldOut: true });
  });

  test("without stockManagement the count is required and saved, but the switches decide", async () => {
    const t = newTest();
    const pro = await shop(t, "pro");
    const id = await pro.me.mutation(api.products.create, await plain(t, { pieces: 2 }));
    expect(await productRow(t, id)).toMatchObject({ pieces: 2, soldOut: false });
    expect((await productRow(t, id))!.fewLeft).toBeUndefined();
    await pro.me.mutation(api.products.update, { productId: id, ...(await plain(t, { pieces: 0, soldOut: false })) });
    expect(await productRow(t, id)).toMatchObject({ pieces: 0, soldOut: false });
    await pro.me.mutation(api.products.setSoldOut, { productId: id, soldOut: true });
    expect(await productRow(t, id)).toMatchObject({ soldOut: true });
    expect((await pro.me.query(api.products.listMine, {}))[0]).toMatchObject({ pieces: 0, tracked: false });
  });
});

describe("hidden by the seller", () => {
  test("off the shop and its product page, out of the plan count, and back on demand", async () => {
    const t = newTest();
    const { me, slug } = await shop(t);
    const id = await me.mutation(api.products.create, await plain(t));
    expect(await shopNames(t, slug)).toEqual(["Sandales"]);

    await me.mutation(api.products.setHiddenBySeller, { productId: id, hidden: true });
    expect(await shopNames(t, slug)).toEqual([]);
    expect(await t.query(api.public.productPrice, { productId: id })).toBeNull();
    expect(await me.query(api.products.visibility, { productId: id })).toEqual({ hiddenBySeller: true, hiddenByAdmin: false });
    expect((await me.query(api.products.listMine, {}))[0]).toMatchObject({ hiddenBySeller: true, overLimit: false });

    await me.mutation(api.products.setHiddenBySeller, { productId: id, hidden: false });
    expect(await shopNames(t, slug)).toEqual(["Sandales"]);
  });

  test("only on your own products; an admin's hide stays", async () => {
    const t = newTest();
    const amani = await shop(t);
    const bea = await shop(t, "business", "bea@shop.cd", "bea-bags");
    const id = await amani.me.mutation(api.products.create, await plain(t));
    await expect(bea.me.mutation(api.products.setHiddenBySeller, { productId: id, hidden: true })).rejects.toThrow(/NOT_FOUND/);
    expect(await bea.me.query(api.products.visibility, { productId: id })).toBeNull();

    const roles = await builtInRoles(t);
    const admin = await insertUserWithRole(t, "boss@vano.app", roles.super_admin);
    await as(t, admin).mutation(api.admin.products.setHidden, { productId: id, hidden: true });
    await amani.me.mutation(api.products.setHiddenBySeller, { productId: id, hidden: false });
    expect(await shopNames(t, amani.slug)).toEqual([]);
  });
});

describe("a sold-out product can't be ordered", () => {
  test("live prices say so, clicks aren't counted, codes are refused", async () => {
    const t = newTest();
    const { me, slug } = await shop(t);
    const id = await me.mutation(api.products.create, await plain(t, { pieces: 1 }));
    await me.mutation(api.discountCodes.create, {
      code: "vip10",
      discount: { kind: "percent", value: 10 },
      target: { kind: "shop", excludedIds: [] },
      endsAt: NOW + 2 * DAY,
    });
    expect(await t.query(api.public.productPrice, { productId: id })).toMatchObject({ soldOut: false, codeField: true });

    await me.mutation(api.salesRecords.record, {
      productId: id,
      quantity: 1,
      finalUnitPrice: 5000,
      source: "inPerson",
      soldAt: NOW - 60_000,
    });
    expect(await t.query(api.public.productPrice, { productId: id })).toMatchObject({ soldOut: true, codeField: false });
    expect((await t.query(api.public.shopPrices, { slug }))?.[0]).toMatchObject({ _id: id, soldOut: true });
    expect(await t.mutation(api.stats.recordWhatsappClick, { productId: id })).toBe(false);
    expect(await t.mutation(api.public.redeemDiscountCode, { productId: id, code: "VIP10", visitorId: VISITOR })).toEqual({
      status: "soldOut",
    });
    const code = await t.run(async (ctx) => (await ctx.db.query("discountCodes").first())!);
    expect(code.uses).toBe(0);
    // Views are still counted.
    expect(await t.mutation(api.stats.recordProductView, { productId: id })).toBe(true);
  });
});
