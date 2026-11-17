import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { as, productArgs, sellerWithShop, newTest } from "./lib/test.utils";

const setup = newTest;

/** Narrows a public page result to an active (not suspended) shop. */
function active<T extends { suspended: boolean } | null>(page: T): Extract<NonNullable<T>, { suspended: false }> {
  expect(page).toMatchObject({ suspended: false });
  return page as Extract<NonNullable<T>, { suspended: false }>;
}

describe("public.shopBasics", () => {
  test("public fields only, null for unknown", async () => {
    const t = setup();
    const { userId } = await sellerWithShop(t);
    expect(await t.query(api.public.shopBasics, { slug: "nope" })).toBeNull();
    const shop = await t.query(api.public.shopBasics, { slug: "chez-amani" });
    expect(shop).toMatchObject({ name: "Chez Amani", slug: "chez-amani", logoUrl: null });
    expect(JSON.stringify(shop)).not.toContain(userId);
  });
});

describe("public.shopBySlug", () => {
  test("null for an unknown slug", async () => {
    const t = setup();
    expect(await t.query(api.public.shopBySlug, { slug: "nope" })).toBeNull();
  });

  test("returns public fields and products, never ownerId", async () => {
    const t = setup();
    const { userId } = await sellerWithShop(t);
    await as(t, userId).mutation(api.products.create, await productArgs(t));
    const page = active(await t.query(api.public.shopBySlug, { slug: "Chez-Amani" }));
    expect(page.shop).toMatchObject({ name: "Chez Amani", language: "fr", currency: "USD" });
    expect(page.shop).not.toHaveProperty("ownerId");
    expect(page.products).toHaveLength(1);
    expect(page.products[0]).toMatchObject({ name: "Robe wax", price: 2500, soldOut: false });
    expect(JSON.stringify(page)).not.toContain(userId);
  });
});

describe("public.productForPage", () => {
  test("returns the product of that shop only", async () => {
    const t = setup();
    const a = await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
    await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
    const productId = await as(t, a.userId).mutation(api.products.create, await productArgs(t));

    const page = active(await t.query(api.public.productForPage, { slug: "shop-a", productId }));
    expect(page.product).toMatchObject({ name: "Robe wax", sizes: ["S", "M"], colors: ["Rouge"] });
    expect(page.product.imageUrls).toHaveLength(1);
    expect(page.shop).not.toHaveProperty("ownerId");

    expect(await t.query(api.public.productForPage, { slug: "shop-b", productId })).toBeNull();
    expect(await t.query(api.public.productForPage, { slug: "nope", productId })).toBeNull();
    expect(await t.query(api.public.productForPage, { slug: "shop-a", productId: "garbage" })).toBeNull();
  });
});

describe("suspended shops", () => {
  test("public queries return only name and language", async () => {
    const t = setup();
    const { userId, shopId } = await sellerWithShop(t);
    const productId = await as(t, userId).mutation(api.products.create, await productArgs(t));
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    const marker = { suspended: true, name: "Chez Amani", language: "fr" };

    expect(await t.query(api.public.shopBasics, { slug: "chez-amani" })).toEqual(marker);
    expect(await t.query(api.public.shopBySlug, { slug: "chez-amani" })).toEqual(marker);
    expect(await t.query(api.public.productForPage, { slug: "chez-amani", productId })).toEqual(marker);
  });

  test("views and WhatsApp clicks aren't counted", async () => {
    const t = setup();
    const { userId, shopId } = await sellerWithShop(t);
    const productId = await as(t, userId).mutation(api.products.create, await productArgs(t));
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    expect(await t.mutation(api.stats.recordShopView, { shopId })).toBe(false);
    expect(await t.mutation(api.stats.recordProductView, { productId })).toBe(false);
    expect(await t.mutation(api.stats.recordWhatsappClick, { productId })).toBe(false);
    expect(await t.run((ctx) => ctx.db.query("shopDailyStats").collect())).toEqual([]);
  });

  test("active shops say so", async () => {
    const t = setup();
    await sellerWithShop(t);
    expect(await t.query(api.public.shopBasics, { slug: "chez-amani" })).toMatchObject({ suspended: false });
  });
});

describe("hidden products", () => {
  test("leave the shop page, 404 on their own page, and aren't counted", async () => {
    const t = setup();
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    const visible = await me.mutation(api.products.create, await productArgs(t, { name: "Robe" }));
    const hidden = await me.mutation(api.products.create, await productArgs(t, { name: "Jupe" }));
    await t.run((ctx) => ctx.db.patch("products", hidden, { hidden: true }));

    const page = active(await t.query(api.public.shopBySlug, { slug: "chez-amani" }));
    expect(page.products.map((p) => p.name)).toEqual(["Robe"]);
    expect(await t.query(api.public.productForPage, { slug: "chez-amani", productId: hidden })).toBeNull();
    expect(await t.query(api.public.productForPage, { slug: "chez-amani", productId: visible })).not.toBeNull();
    expect(await t.mutation(api.stats.recordProductView, { productId: hidden })).toBe(false);
    expect(await t.mutation(api.stats.recordWhatsappClick, { productId: hidden })).toBe(false);

    // The seller still sees it, flagged, and saving it doesn't unhide it.
    const mine = await me.query(api.products.listMine, {});
    expect(mine.map((p) => [p.name, p.hidden])).toEqual([["Jupe", true], ["Robe", false]]);
    expect((await me.query(api.products.getMine, { productId: hidden }))?.hidden).toBe(true);
    await me.mutation(api.products.update, { productId: hidden, ...(await productArgs(t, { name: "Jupe 2" })) });
    expect((await t.run((ctx) => ctx.db.get("products", hidden)))?.hidden).toBe(true);
  });
});
