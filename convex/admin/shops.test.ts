import { describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  productArgs,
  sellerWithShop,
  shopArgs,
  storeFile,
  type T,
} from "../lib/test.utils";

/** A super admin and three shops with different currencies, categories, statuses. */
async function world(t: T) {
  const ids = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const amani = await sellerWithShop(t, "amani@shop.cd", {
    name: "Chez Amani",
    slug: "chez-amani",
    currency: "USD",
    categories: ["clothes", "shoes"],
  });
  const bags = await sellerWithShop(t, "bea@shop.cd", {
    name: "Bea Bags",
    slug: "bea-bags",
    currency: "CDF",
    categories: ["bags"],
  });
  const kito = await sellerWithShop(t, "kito@shop.ke", {
    name: "Kito Shoes",
    slug: "kito-shoes",
    currency: "KES",
    categories: ["shoes"],
    whatsappNumber: "+254 712 345 678",
    country: "KE",
  });
  await t.run((ctx) => ctx.db.patch("shops", bags.shopId, { status: "suspended" }));
  await t.run(async (ctx) => {
    for (const s of [amani.shopId, kito.shopId]) await ctx.db.patch("shops", s, { status: "active" });
  });
  return { ids, admin, amani, bags, kito };
}

const page = { numItems: 50, cursor: null };
const names = (rows: { name: string }[]) => rows.map((r) => r.name).sort();

describe("admin.shops.list", () => {
  test("lists shops newest first with owner email and status", async () => {
    const t = newTest();
    const w = await world(t);
    const result = await as(t, w.admin).query(api.admin.shops.list, { paginationOpts: page });
    expect(result.page.map((r) => r.name)).toEqual(["Kito Shoes", "Bea Bags", "Chez Amani"]);
    expect(result.page.find((r) => r.name === "Bea Bags")).toMatchObject({
      slug: "bea-bags",
      status: "suspended",
      currency: "CDF",
      categories: ["bags"],
      ownerEmail: "bea@shop.cd",
    });
  });

  test("filters by status, currency, category, and searches the name", async () => {
    const t = newTest();
    const w = await world(t);
    const q = async (args: Record<string, string>) =>
      names((await as(t, w.admin).query(api.admin.shops.list, { paginationOpts: page, ...args })).page);
    expect(await q({ status: "suspended" })).toEqual(["Bea Bags"]);
    expect(await q({ status: "active", currency: "KES" })).toEqual(["Kito Shoes"]);
    expect(await q({ currency: "USD" })).toEqual(["Chez Amani"]);
    expect(await q({ category: "shoes" })).toEqual(["Chez Amani", "Kito Shoes"]);
    expect(await q({ category: "shoes", status: "active", currency: "KES" })).toEqual(["Kito Shoes"]);
    expect(await q({ search: "chez" })).toEqual(["Chez Amani"]);
    expect(await q({ search: "kito", status: "suspended" })).toEqual([]);
    expect(await q({ search: "bea", category: "bags" })).toEqual(["Bea Bags"]);
  });

  test("paginates", async () => {
    const t = newTest();
    const w = await world(t);
    const first = await as(t, w.admin).query(api.admin.shops.list, { paginationOpts: { numItems: 2, cursor: null } });
    expect(first.page).toHaveLength(2);
    const second = await as(t, w.admin).query(api.admin.shops.list, {
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page.map((r) => r.name)).toEqual(["Chez Amani"]);
  });

  test("needs shops.view; suspended and signed-out callers are refused", async () => {
    const t = newTest();
    const w = await world(t);
    const nope = await insertUserWithRole(t, "x@vano.app", await insertRole(t, "Support", ["users.view"]));
    await expect(as(t, nope).query(api.admin.shops.list, { paginationOpts: page })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.amani.userId).query(api.admin.shops.list, { paginationOpts: page })).rejects.toThrow(/FORBIDDEN/);
    await t.run((ctx) => ctx.db.patch("users", w.admin, { status: "suspended" }));
    await expect(as(t, w.admin).query(api.admin.shops.list, { paginationOpts: page })).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    await expect(t.query(api.admin.shops.list, { paginationOpts: page })).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});

describe("admin.shops.get / products", () => {
  test("details with owner and product count; products include hidden ones", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.amani.userId);
    await me.mutation(api.products.create, await productArgs(t, { name: "Robe" }));
    const hiddenId = await me.mutation(api.products.create, await productArgs(t, { name: "Jupe" }));
    await t.run((ctx) => ctx.db.patch("products", hiddenId, { hidden: true }));

    expect(await as(t, w.admin).query(api.admin.shops.get, { shopId: w.amani.shopId })).toMatchObject({
      name: "Chez Amani",
      status: "active",
      whatsappNumber: "+243812345678",
      owner: { _id: w.amani.userId, email: "amani@shop.cd" },
      productCount: 2,
    });
    const products = await as(t, w.admin).query(api.admin.shops.products, {
      shopId: w.amani.shopId,
      paginationOpts: page,
    });
    expect(products.page.map((p) => [p.name, p.hidden])).toEqual([["Jupe", true], ["Robe", false]]);
  });

  test("null for unknown ids; needs shops.view", async () => {
    const t = newTest();
    const w = await world(t);
    expect(await as(t, w.admin).query(api.admin.shops.get, { shopId: "nope" })).toBeNull();
    expect(await as(t, w.admin).query(api.admin.shops.get, { shopId: w.admin })).toBeNull();
    await expect(
      as(t, w.amani.userId).query(api.admin.shops.get, { shopId: w.amani.shopId as Id<"shops"> }),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

const audit = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());
const totals = async (t: T) => (await t.query(internal.migrations.rbacV1Status, {})).totals;

describe("admin.shops.setStatus", () => {
  test("suspending locks the seller, hides the shop publicly, and is logged", async () => {
    const t = newTest();
    const w = await world(t);
    const productId = await as(t, w.amani.userId).mutation(api.products.create, await productArgs(t));
    await as(t, w.admin).mutation(api.admin.shops.setStatus, { shopId: w.amani.shopId, status: "suspended" });

    await expect(as(t, w.amani.userId).mutation(api.products.create, await productArgs(t))).rejects.toThrow(
      /SHOP_SUSPENDED/,
    );
    const publicPage = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    expect(publicPage).toEqual({ suspended: true, name: "Chez Amani", language: "fr" });
    expect(JSON.stringify(publicPage)).not.toContain("+243");
    expect(await t.mutation(api.stats.recordWhatsappClick, { productId })).toBe(false);
    expect(await audit(t)).toEqual([
      expect.objectContaining({
        action: "shop.suspend",
        targetType: "shop",
        targetId: w.amani.shopId,
        targetLabel: "Chez Amani (/chez-amani)",
      }),
    ]);
  });

  test("reactivating restores everything; the same status again does nothing", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.shops.setStatus, { shopId: w.bags.shopId, status: "active" });
    await as(t, w.admin).mutation(api.admin.shops.setStatus, { shopId: w.bags.shopId, status: "active" });
    expect(await t.query(api.public.shopBasics, { slug: "bea-bags" })).toMatchObject({ suspended: false });
    await as(t, w.bags.userId).mutation(api.products.create, await productArgs(t, { category: "bags" }));
    expect((await audit(t)).map((a) => a.action)).toEqual(["shop.reactivate"]);
  });

  test("needs shops.suspend", async () => {
    const t = newTest();
    const w = await world(t);
    const viewer = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Viewer", ["shops.view"]));
    await expect(
      as(t, viewer).mutation(api.admin.shops.setStatus, { shopId: w.amani.shopId, status: "suspended" }),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("admin.shops.remove", () => {
  test("deletes the shop now and purges products, files and stats in the background", async () => {
    vi.useFakeTimers();
    try {
      const t = newTest();
      const ids = await builtInRoles(t);
      const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
      const logoId = await storeFile(t);
      const { userId, shopId } = await sellerWithShop(t, "amani@shop.cd", { logoId });
      const me = as(t, userId);
      // More than one purge batch of products (25), each with an image.
      const productIds: Id<"products">[] = [];
      for (let i = 0; i < 27; i++) productIds.push(await me.mutation(api.products.create, await productArgs(t)));
      await t.mutation(api.stats.recordWhatsappClick, { productId: productIds[0] });
      await t.mutation(api.stats.recordProductView, { productId: productIds[1] });
      const before = await totals(t);
      expect(before).toMatchObject({ shops: 1, products: 27, whatsappClicks: 1 });

      await as(t, admin).mutation(api.admin.shops.remove, { shopId });

      // Gone at once: public link is a 404, the owner has no shop.
      expect(await t.query(api.public.shopBasics, { slug: "chez-amani" })).toBeNull();
      expect(await me.query(api.shops.myShop, {})).toBeNull();
      expect(await t.run((ctx) => ctx.db.system.get("_storage", logoId))).toBeNull();
      expect(await audit(t)).toEqual([
        expect.objectContaining({
          action: "shop.delete",
          targetLabel: "Chez Amani (/chez-amani)",
          details: { owner: "amani@shop.cd", products: 27 },
        }),
      ]);

      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const left = await t.run(async (ctx) => ({
        products: (await ctx.db.query("products").collect()).length,
        uploads: (await ctx.db.query("uploads").collect()).length,
        files: (await ctx.db.system.query("_storage").collect()).length,
        shopStats: (await ctx.db.query("shopDailyStats").collect()).length,
        productStats: (await ctx.db.query("productDailyStats").collect()).length,
      }));
      expect(left).toEqual({ products: 0, uploads: 0, files: 0, shopStats: 0, productStats: 0 });
      expect(await totals(t)).toMatchObject({ shops: 0, products: 0, whatsappClicks: 0 });

      // The owner is kept and can open a new shop with the same link.
      expect(await t.run((ctx) => ctx.db.get("users", userId))).not.toBeNull();
      await me.mutation(api.shops.create, shopArgs());
    } finally {
      vi.useRealTimers();
    }
  });

  test("needs shops.delete", async () => {
    const t = newTest();
    const w = await world(t);
    const mod = await insertUserWithRole(
      t,
      "m@vano.app",
      await insertRole(t, "Moderator", ["shops.view", "shops.suspend"]),
    );
    await expect(as(t, mod).mutation(api.admin.shops.remove, { shopId: w.amani.shopId })).rejects.toThrow(/FORBIDDEN/);
    expect(await t.run((ctx) => ctx.db.get("shops", w.amani.shopId))).not.toBeNull();
  });
});
