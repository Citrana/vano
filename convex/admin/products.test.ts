import { describe, expect, test } from "vitest";
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
  type T,
} from "../lib/test.utils";

/** A super admin, two shops and a few products (one hidden). */
async function world(t: T) {
  const ids = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const amani = await sellerWithShop(t, "amani@shop.cd", { name: "Chez Amani", slug: "chez-amani" });
  const bea = await sellerWithShop(t, "bea@shop.cd", {
    name: "Bea Bags",
    slug: "bea-bags",
    currency: "CDF",
    categories: ["bags"],
  });
  const robe = await as(t, amani.userId).mutation(api.products.create, await productArgs(t, { name: "Robe wax" }));
  const shoes = await as(t, amani.userId).mutation(
    api.products.create,
    await productArgs(t, { name: "Sandales", category: "shoes" }),
  );
  const bag = await as(t, bea.userId).mutation(
    api.products.create,
    await productArgs(t, { name: "Sac cuir", category: "bags", price: 1_500_000 }),
  );
  await t.run(async (ctx) => {
    await ctx.db.patch("products", robe, { hidden: false });
    await ctx.db.patch("products", shoes, { hidden: true });
    await ctx.db.patch("products", bag, { hidden: false });
  });
  return { ids, admin, amani, bea, robe, shoes, bag };
}

const page = { numItems: 50, cursor: null };
const names = (rows: { name: string }[]) => rows.map((r) => r.name).sort();
const audit = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());

describe("admin.products.list", () => {
  test("lists products newest first with their shop", async () => {
    const t = newTest();
    const w = await world(t);
    const result = await as(t, w.admin).query(api.admin.products.list, { paginationOpts: page });
    expect(result.page.map((r) => r.name)).toEqual(["Sac cuir", "Sandales", "Robe wax"]);
    expect(result.page[0]).toMatchObject({
      price: 1_500_000,
      category: "bags",
      hidden: false,
      shop: { name: "Bea Bags", slug: "bea-bags", status: "active", currency: "CDF" },
    });
  });

  test("filters by visibility and category, and searches the name", async () => {
    const t = newTest();
    const w = await world(t);
    const q = async (args: Record<string, string>) =>
      names((await as(t, w.admin).query(api.admin.products.list, { paginationOpts: page, ...args })).page);
    expect(await q({ visibility: "hidden" })).toEqual(["Sandales"]);
    expect(await q({ visibility: "visible" })).toEqual(["Robe wax", "Sac cuir"]);
    expect(await q({ category: "clothes" })).toEqual(["Robe wax"]);
    expect(await q({ visibility: "visible", category: "bags" })).toEqual(["Sac cuir"]);
    expect(await q({ search: "sac" })).toEqual(["Sac cuir"]);
    expect(await q({ search: "san", visibility: "visible" })).toEqual([]);
    expect(await q({ search: "robe", category: "clothes" })).toEqual(["Robe wax"]);
  });

  test("paginates and skips products of a deleted shop", async () => {
    const t = newTest();
    const w = await world(t);
    const first = await as(t, w.admin).query(api.admin.products.list, { paginationOpts: { numItems: 2, cursor: null } });
    expect(first.page).toHaveLength(2);
    // Shop deleted, its product still being purged: not listed.
    await t.run((ctx) => ctx.db.delete("shops", w.bea.shopId));
    const after = await as(t, w.admin).query(api.admin.products.list, { paginationOpts: page });
    expect(names(after.page)).toEqual(["Robe wax", "Sandales"]);
  });

  test("needs products.view; suspended and signed-out callers are refused", async () => {
    const t = newTest();
    const w = await world(t);
    const nope = await insertUserWithRole(t, "x@vano.app", await insertRole(t, "Support", ["shops.view"]));
    await expect(as(t, nope).query(api.admin.products.list, { paginationOpts: page })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.amani.userId).query(api.admin.products.list, { paginationOpts: page })).rejects.toThrow(
      /FORBIDDEN/,
    );
    await t.run((ctx) => ctx.db.patch("users", w.admin, { status: "suspended" }));
    await expect(as(t, w.admin).query(api.admin.products.list, { paginationOpts: page })).rejects.toThrow(
      /ACCOUNT_SUSPENDED/,
    );
    await expect(t.query(api.admin.products.list, { paginationOpts: page })).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});

describe("admin.products.setHidden", () => {
  test("hiding removes it from the public shop and is logged; unhiding restores it", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.products.setHidden, { productId: w.robe, hidden: true });

    const shopPage = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    expect(shopPage && !shopPage.suspended ? shopPage.products : null).toEqual([]);
    expect(await t.query(api.public.productForPage, { slug: "chez-amani", productId: w.robe })).toBeNull();
    expect(await t.mutation(api.stats.recordWhatsappClick, { productId: w.robe })).toBe(false);
    const mine = await as(t, w.amani.userId).query(api.products.listMine, {});
    expect(mine.find((p) => p._id === w.robe)?.hidden).toBe(true);
    expect(await audit(t)).toEqual([
      expect.objectContaining({
        action: "product.hide",
        targetType: "product",
        targetId: w.robe,
        targetLabel: "Robe wax — Chez Amani (/chez-amani)",
      }),
    ]);

    await as(t, w.admin).mutation(api.admin.products.setHidden, { productId: w.robe, hidden: false });
    await as(t, w.admin).mutation(api.admin.products.setHidden, { productId: w.robe, hidden: false });
    expect(await t.query(api.public.productForPage, { slug: "chez-amani", productId: w.robe })).not.toBeNull();
    expect((await audit(t)).map((a) => a.action)).toEqual(["product.hide", "product.unhide"]);
  });

  test("needs products.hide", async () => {
    const t = newTest();
    const w = await world(t);
    const viewer = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Viewer", ["products.view"]));
    await expect(
      as(t, viewer).mutation(api.admin.products.setHidden, { productId: w.robe, hidden: true }),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("admin.products.remove", () => {
  test("deletes the product, its photos, upload rows and stats; logged and counted", async () => {
    const t = newTest();
    const w = await world(t);
    await t.mutation(api.stats.recordProductView, { productId: w.robe });
    const robe = (await t.run((ctx) => ctx.db.get("products", w.robe)))!;
    const before = (await t.query(internal.migrations.rbacV1Status, {})).totals.products;

    await as(t, w.admin).mutation(api.admin.products.remove, { productId: w.robe });

    const left = await t.run(async (ctx) => ({
      product: await ctx.db.get("products", w.robe),
      file: await ctx.db.system.get("_storage", robe.imageIds[0]),
      upload: await ctx.db
        .query("uploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", robe.imageIds[0]))
        .unique(),
      stats: await ctx.db
        .query("productDailyStats")
        .withIndex("by_productId_and_day", (q) => q.eq("productId", w.robe as Id<"products">))
        .collect(),
    }));
    expect(left).toEqual({ product: null, file: null, upload: null, stats: [] });
    expect((await t.query(internal.migrations.rbacV1Status, {})).totals.products).toBe(before - 1);
    expect((await audit(t)).map((a) => [a.action, a.targetLabel])).toEqual([
      ["product.delete", "Robe wax — Chez Amani (/chez-amani)"],
    ]);
  });

  test("needs products.delete; unknown product is NOT_FOUND", async () => {
    const t = newTest();
    const w = await world(t);
    const mod = await insertUserWithRole(t, "m@vano.app", await insertRole(t, "Mod", ["products.view", "products.hide"]));
    await expect(as(t, mod).mutation(api.admin.products.remove, { productId: w.robe })).rejects.toThrow(/FORBIDDEN/);
    await as(t, w.admin).mutation(api.admin.products.remove, { productId: w.robe });
    await expect(as(t, w.admin).mutation(api.admin.products.remove, { productId: w.robe })).rejects.toThrow(/NOT_FOUND/);
  });
});
