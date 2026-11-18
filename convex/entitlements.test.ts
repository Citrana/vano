import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { canShopDo, visibleProductIds } from "./lib/entitlements";
import { PLAN_LIMITS } from "./lib/plans";
import {
  as,
  insertProducts,
  newTest,
  productArgs,
  sellerWithShop,
  setSubscription,
  storeFile,
  type T,
} from "./lib/test.utils";

const FREE = PLAN_LIMITS.free;
const PRO = PLAN_LIMITS.pro;

describe("canShopDo", () => {
  test("product limit; unlimited plans are left to the platform ceiling", () => {
    expect(canShopDo(FREE, { kind: "addProduct", products: 9 })).toBeNull();
    expect(canShopDo(FREE, { kind: "addProduct", products: 10 })).toBe("PLAN_LIMIT_PRODUCTS");
    expect(canShopDo(PLAN_LIMITS.business, { kind: "addProduct", products: 500 })).toBeNull();
  });
  test("photos: a product over the limit can keep its photos but not gain any", () => {
    expect(canShopDo(FREE, { kind: "setPhotos", count: 3 })).toBeNull();
    expect(canShopDo(FREE, { kind: "setPhotos", count: 4 })).toBe("PLAN_LIMIT_PHOTOS");
    expect(canShopDo(FREE, { kind: "setPhotos", count: 6, previousCount: 6 })).toBeNull();
    expect(canShopDo(FREE, { kind: "setPhotos", count: 5, previousCount: 6 })).toBeNull();
    expect(canShopDo(FREE, { kind: "setPhotos", count: 5, previousCount: 4 })).toBe("PLAN_LIMIT_PHOTOS");
  });
  test("pins and features", () => {
    expect(canShopDo(FREE, { kind: "pinProduct", pinned: 9 })).toBeNull();
    expect(canShopDo(FREE, { kind: "pinProduct", pinned: 10 })).toBe("PLAN_LIMIT_PRODUCTS");
    expect(canShopDo(FREE, { kind: "feature", feature: "shopStats" })).toBe("PLAN_FEATURE_LOCKED");
    expect(canShopDo(PRO, { kind: "feature", feature: "shopStats" })).toBeNull();
  });
});

describe("visibleProductIds", () => {
  const p = (id: string, created: number, extra: { pinnedAt?: number; hidden?: boolean } = {}) => ({
    _id: id as Id<"products">,
    _creationTime: created,
    ...extra,
  });
  const limits = { ...FREE, products: 2 };
  test("newest first, pinned before them, admin-hidden never", () => {
    const products = [p("a", 1), p("b", 2), p("c", 3), p("d", 4, { hidden: true })];
    expect([...visibleProductIds(products, limits)].sort()).toEqual(["b", "c"]);
    const pinned = [p("a", 1, { pinnedAt: 10 }), p("b", 2), p("c", 3), p("d", 4, { hidden: true, pinnedAt: 20 })];
    expect([...visibleProductIds(pinned, limits)].sort()).toEqual(["a", "c"]);
  });
  test("everything when under the limit", () => {
    expect(visibleProductIds([p("a", 1), p("b", 2)], PRO).size).toBe(2);
  });
});

async function freeShop(t: T, products = 0, photos = 1) {
  const seller = await sellerWithShop(t);
  await setSubscription(t, seller.shopId, { plan: "free", status: "free" });
  const ids = await insertProducts(t, seller.shopId, products, photos);
  return { ...seller, ids, me: as(t, seller.userId) };
}

describe("products under plan limits", () => {
  test("Free can't add an 11th product; the trial (Pro) can", async () => {
    const t = newTest();
    const { me, shopId } = await freeShop(t, 10);
    await expect(me.mutation(api.products.create, await productArgs(t))).rejects.toThrow(/PLAN_LIMIT_PRODUCTS/);
    await setSubscription(t, shopId, { plan: "pro", status: "trialing", periodEnd: Date.now() + 86_400_000 });
    await expect(me.mutation(api.products.create, await productArgs(t))).resolves.toBeTruthy();
  });

  test("a period past its end counts as Free before the expiry job runs", async () => {
    const t = newTest();
    const { me, shopId } = await freeShop(t);
    await setSubscription(t, shopId, { plan: "pro", status: "trialing", periodEnd: Date.now() - 1000 });
    const four = await Promise.all([1, 2, 3, 4].map(() => storeFile(t)));
    await expect(me.mutation(api.products.create, await productArgs(t, { imageIds: four }))).rejects.toThrow(/PLAN_LIMIT_PHOTOS/);
  });

  test("Free: 3 photos on new products; an over-limit product keeps its photos but gains none", async () => {
    const t = newTest();
    const { me, ids } = await freeShop(t, 1, 5);
    const four = await Promise.all([1, 2, 3, 4].map(() => storeFile(t)));
    await expect(me.mutation(api.products.create, await productArgs(t, { imageIds: four }))).rejects.toThrow(/PLAN_LIMIT_PHOTOS/);

    const product = await t.run((ctx) => ctx.db.get("products", ids[0]));
    const update = async (imageIds: Id<"_storage">[]) =>
      me.mutation(api.products.update, { productId: ids[0], ...(await productArgs(t, { imageIds })) });
    // The fixture's photos aren't claimed yet; claim them as the seller would have.
    await t.run(async (ctx) => {
      for (const storageId of product!.imageIds) {
        const owner = (await ctx.db.get("shops", product!.shopId))!.ownerId;
        await ctx.db.insert("uploads", { storageId, ownerId: owner });
      }
    });
    await expect(update(product!.imageIds)).resolves.toBeNull();
    await expect(update(product!.imageIds.slice(0, 4))).resolves.toBeNull();
    await expect(update([...product!.imageIds.slice(0, 4), await storeFile(t)])).rejects.toThrow(/PLAN_LIMIT_PHOTOS/);
  });

  test("listMine marks products over the limit; the newest stay visible", async () => {
    const t = newTest();
    const { me, ids } = await freeShop(t, 12);
    const list = await me.query(api.products.listMine, {});
    const over = list.filter((p) => p.overLimit).map((p) => p._id);
    expect(over.sort()).toEqual([ids[0], ids[1]].sort());
  });
});

describe("products.setPinned", () => {
  test("pinning an over-limit product shows it instead of the oldest visible one", async () => {
    const t = newTest();
    const { me, ids } = await freeShop(t, 11);
    await me.mutation(api.products.setPinned, { productId: ids[0], pinned: true });
    const list = await me.query(api.products.listMine, {});
    expect(list.filter((p) => p.overLimit).map((p) => p._id)).toEqual([ids[1]]);
    expect(list.find((p) => p._id === ids[0])).toMatchObject({ pinned: true, overLimit: false });
    // Repeating is a no-op; unpinning restores the default.
    await me.mutation(api.products.setPinned, { productId: ids[0], pinned: true });
    await me.mutation(api.products.setPinned, { productId: ids[0], pinned: false });
    expect((await me.query(api.products.listMine, {})).filter((p) => p.overLimit).map((p) => p._id)).toEqual([ids[0]]);
  });

  test("can't pin more products than the plan shows", async () => {
    const t = newTest();
    const { me, ids } = await freeShop(t, 11);
    for (const id of ids.slice(0, 10)) await me.mutation(api.products.setPinned, { productId: id, pinned: true });
    await expect(me.mutation(api.products.setPinned, { productId: ids[10], pinned: true })).rejects.toThrow(/PLAN_LIMIT_PRODUCTS/);
  });

  test("someone else's product is NOT_FOUND; a suspended shop can't pin", async () => {
    const t = newTest();
    const { ids, shopId, me } = await freeShop(t, 1);
    const other = await sellerWithShop(t, "b@x.com", { slug: "other-shop" });
    await expect(as(t, other.userId).mutation(api.products.setPinned, { productId: ids[0], pinned: true })).rejects.toThrow(/NOT_FOUND/);
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    await expect(me.mutation(api.products.setPinned, { productId: ids[0], pinned: true })).rejects.toThrow(/SHOP_SUSPENDED/);
  });
});

describe("public pages follow the plan", () => {
  test("over-limit products aren't listed and their page is gone; photos are capped", async () => {
    const t = newTest();
    const { ids } = await freeShop(t, 11, 5);
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    if (!page || page.suspended) throw new Error("expected a shop");
    expect(page.products).toHaveLength(10);
    expect(page.products.map((p) => p._id)).not.toContain(ids[0]);
    expect(await t.query(api.public.productForPage, { slug: "chez-amani", productId: ids[0] })).toBeNull();
    const visible = await t.query(api.public.productForPage, { slug: "chez-amani", productId: ids[10] });
    if (!visible || visible.suspended) throw new Error("expected a product");
    expect(visible.product.imageUrls).toHaveLength(3);
  });
});

describe("stats are a plan feature", () => {
  test("locked on Free, open on the trial", async () => {
    const t = newTest();
    const { me, shopId } = await freeShop(t);
    expect(await me.query(api.stats.summary, { today: "2026-11-17" })).toEqual({ locked: true });
    await setSubscription(t, shopId, { plan: "pro", status: "trialing", periodEnd: Date.now() + 86_400_000 });
    expect((await me.query(api.stats.summary, { today: "2026-11-17" })).locked).toBe(false);
  });
});
