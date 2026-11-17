import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
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
