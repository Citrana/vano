import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { canShopDo, visibleProductIds } from "./lib/entitlements";
import { DEFAULT_PLAN_CONFIG } from "./lib/planDefaults";
import { resolvePlanLimits } from "./lib/planFeatures";
import { DAY_MS } from "./lib/plans";
import {
  as,
  builtInRoles,
  insertProducts,
  insertUserWithRole,
  newTest,
  productArgs,
  sellerWithShop,
  setSubscription,
  storeFile,
  type T,
} from "./lib/test.utils";

const FREE = resolvePlanLimits(DEFAULT_PLAN_CONFIG, "free");
const PRO = resolvePlanLimits(DEFAULT_PLAN_CONFIG, "pro");
const BUSINESS = resolvePlanLimits(DEFAULT_PLAN_CONFIG, "business");

describe("canShopDo", () => {
  test("product limit; unlimited plans are left to the platform ceiling", () => {
    expect(canShopDo(FREE, { kind: "addProduct", products: 9 })).toBeNull();
    expect(canShopDo(FREE, { kind: "addProduct", products: 10 })).toBe("PLAN_LIMIT_PRODUCTS");
    expect(canShopDo(BUSINESS, { kind: "addProduct", products: 500 })).toBeNull();
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

  test("a period past its end and its grace days counts as Free before the expiry job runs", async () => {
    const t = newTest();
    const { me, shopId } = await freeShop(t);
    await setSubscription(t, shopId, { plan: "pro", status: "trialing", periodEnd: Date.now() - 3 * 86_400_000 - 1000 });
    const four = await Promise.all([1, 2, 3, 4].map(() => storeFile(t)));
    await expect(me.mutation(api.products.create, await productArgs(t, { imageIds: four }))).rejects.toThrow(/PLAN_LIMIT_PHOTOS/);
  });

  test("during the grace days the shop keeps its plan", async () => {
    const t = newTest();
    const { me, shopId } = await freeShop(t);
    await setSubscription(t, shopId, { plan: "pro", status: "trialing", periodEnd: Date.now() - 86_400_000 });
    const four = await Promise.all([1, 2, 3, 4].map(() => storeFile(t)));
    await expect(me.mutation(api.products.create, await productArgs(t, { imageIds: four }))).resolves.toBeDefined();
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

// ---------------------------------------------------------------------------
// The central check reads the live plan config and shop exceptions.

afterEach(() => vi.useRealTimers());

const TODAY = "2026-11-19";
const statsLocked = async (me: ReturnType<typeof as>) =>
  (await me.query(api.stats.summary, { today: TODAY })).locked;
const limitsOf = async (me: ReturnType<typeof as>) => (await me.query(api.billing.mine, {})).limits;

async function adminOf(t: T) {
  const roles = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", roles.super_admin);
  return as(t, admin);
}

describe("central check: plans", () => {
  test("Free, the trial (= Pro), Pro, Business (includes Pro) and Enterprise", async () => {
    const t = newTest();
    const { me, shopId } = await freeShop(t);
    const end = Date.now() + 30 * DAY_MS;
    expect(await limitsOf(me)).toEqual({ products: 10, photosPerProduct: 3, teamMembers: 0, features: [] });
    expect(await statsLocked(me)).toBe(true);

    await setSubscription(t, shopId, { plan: "pro", status: "trialing", periodEnd: end });
    expect(await limitsOf(me)).toMatchObject({ products: 50, photosPerProduct: 6, features: ["allLooks", "featuredSections", "announcementBar", "shopFilters", "salesPromotions", "shopStats"] });
    expect(await statsLocked(me)).toBe(false);

    await setSubscription(t, shopId, { plan: "pro", status: "active", periodEnd: end });
    expect((await limitsOf(me)).products).toBe(50);

    await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: end });
    const business = await limitsOf(me);
    expect(business.products).toBeNull();
    expect(business.features).toEqual(expect.arrayContaining(["allLooks", "salesPromotions", "shopStats", "teamRoles", "discountCodes"]));

    await setSubscription(t, shopId, { plan: "enterprise", status: "active", periodEnd: end });
    expect((await limitsOf(me)).features).toContain("multiShop");
  });

  test("expired plan and no subscription row", async () => {
    const t = newTest();
    const { me, shopId } = await freeShop(t);
    await setSubscription(t, shopId, { plan: "business", status: "expired" });
    expect((await limitsOf(me)).products).toBe(10);
    // A shop created before billing (no row yet) is on the trial from its creation.
    await t.run(async (ctx) => {
      const sub = await ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique();
      await ctx.db.delete("subscriptions", sub!._id);
    });
    expect((await limitsOf(me)).products).toBe(50);
  });

  test("downgrade keeps every product; over-limit ones are hidden, not deleted", async () => {
    const t = newTest();
    const { me, shopId, ids } = await freeShop(t, 12);
    await setSubscription(t, shopId, { plan: "pro", status: "active", periodEnd: Date.now() + DAY_MS });
    expect((await me.query(api.products.listMine, {})).filter((p) => p.overLimit)).toEqual([]);
    await setSubscription(t, shopId, { plan: "free", status: "expired" });
    const list = await me.query(api.products.listMine, {});
    expect(list).toHaveLength(12);
    expect(list.filter((p) => p.overLimit).map((p) => p._id).sort()).toEqual([ids[0], ids[1]].sort());
  });
});

describe("central check: admin changes apply at once", () => {
  test("a feature moved to Free and a new limit reach the shop without code changes", async () => {
    const t = newTest();
    const { me } = await freeShop(t, 10);
    const admin = await adminOf(t);
    let { version } = await admin.query(api.admin.plans.get, {});
    version = await admin.mutation(api.admin.plans.setFeatureValue, { expectedVersion: version, feature: "shopStats", plan: "free", value: true });
    expect(await statsLocked(me)).toBe(false);
    await admin.mutation(api.admin.plans.setFeatureValue, { expectedVersion: version, feature: "products", plan: "free", value: 11 });
    await expect(me.mutation(api.products.create, await productArgs(t))).resolves.toBeTruthy();
    await expect(me.mutation(api.products.create, await productArgs(t))).rejects.toThrow(/PLAN_LIMIT_PRODUCTS/);
  });

  test("lowering a limit hides extra products but deletes nothing", async () => {
    const t = newTest();
    const { me } = await freeShop(t, 10);
    const admin = await adminOf(t);
    const { version } = await admin.query(api.admin.plans.get, {});
    await admin.mutation(api.admin.plans.setFeatureValue, { expectedVersion: version, feature: "products", plan: "free", value: 4 });
    const list = await me.query(api.products.listMine, {});
    expect(list).toHaveLength(10);
    expect(list.filter((p) => p.overLimit)).toHaveLength(6);
  });
});

describe("central check: shop exceptions win", () => {
  test("a granted feature and a higher limit apply until revoked or expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T12:00:00Z"));
    const t = newTest();
    const { me, shopId } = await freeShop(t, 10);
    const admin = await adminOf(t);
    const endsAt = Date.now() + 7 * DAY_MS;
    await admin.mutation(api.admin.planExceptions.grant, { shopId, feature: "shopStats", value: true, endsAt, reason: "Partner shop" });
    const products = await admin.mutation(api.admin.planExceptions.grant, { shopId, feature: "products", value: 12, endsAt, reason: "Support case" });
    expect(await statsLocked(me)).toBe(false);
    await expect(me.mutation(api.products.create, await productArgs(t))).resolves.toBeTruthy();

    await admin.mutation(api.admin.planExceptions.revoke, { exceptionId: products });
    expect((await limitsOf(me)).products).toBe(10);

    // Past the end: mutations stop counting it at once; the job clears it for queries.
    vi.setSystemTime(endsAt + 1000);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await statsLocked(me)).toBe(true);
  });
});
