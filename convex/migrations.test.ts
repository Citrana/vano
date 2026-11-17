import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { findRoleByKey } from "./lib/roles";
import {
  as,
  builtInRoles,
  insertUserWithRole,
  newTest,
  sellerWithShop,
  shopArgs,
  storeFile,
  type T,
} from "./lib/test.utils";

/**
 * Data written before the RBAC work has no role / status / hidden fields
 * and was never counted. Tests insert such "legacy" documents directly.
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function migrate(t: T) {
  const result = await t.mutation(internal.migrations.rbacV1, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return result;
}

const status = (t: T) => t.query(internal.migrations.rbacV1Status, {});

async function legacyUser(t: T, email: string): Promise<Id<"users">> {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

async function legacyShop(t: T, ownerId: Id<"users">, slug: string): Promise<Id<"shops">> {
  return await t.run((ctx) =>
    ctx.db.insert("shops", {
      ownerId,
      name: "Old shop",
      slug,
      currency: "USD",
      language: "fr",
      categories: ["clothes", "shoes"],
      whatsappNumber: "+243812345678",
      city: "Goma",
      country: "CD",
    }),
  );
}

async function legacyProduct(t: T, shopId: Id<"shops">): Promise<Id<"products">> {
  const imageId = await storeFile(t);
  return await t.run((ctx) =>
    ctx.db.insert("products", {
      shopId,
      name: "Robe",
      price: 2500,
      category: "clothes",
      sizes: [],
      colors: [],
      imageIds: [imageId],
      soldOut: false,
      updatedAt: 0,
    }),
  );
}

describe("migrations:rbacV1", () => {
  test("fixes legacy documents and backfills the counters", async () => {
    const t = newTest();
    const userId = await legacyUser(t, "old@example.com");
    const shopId = await legacyShop(t, userId, "old-shop");
    const productId = await legacyProduct(t, shopId);
    await t.run((ctx) =>
      ctx.db.insert("shopDailyStats", {
        shopId,
        day: "2026-01-01",
        shopViews: 4,
        productViews: 2,
        whatsappClicks: 3,
      }),
    );
    expect((await status(t)).totals).toEqual({ users: 0, shops: 0, products: 0, whatsappClicks: 0 });

    expect(await migrate(t)).toBe("started");

    const seller = await t.run(async (ctx) => (await findRoleByKey(ctx, "seller"))!._id);
    expect(await t.run((ctx) => ctx.db.get("users", userId))).toMatchObject({
      roleId: seller,
      status: "active",
    });
    expect((await t.run((ctx) => ctx.db.get("shops", shopId)))?.status).toBe("active");
    expect((await t.run((ctx) => ctx.db.get("products", productId)))?.hidden).toBe(false);
    expect(await status(t)).toMatchObject({
      status: "done",
      totals: { users: 1, shops: 1, products: 1, whatsappClicks: 3 },
    });
  });

  test("never overwrites an existing role or status", async () => {
    const t = newTest();
    const ids = await builtInRoles(t);
    const admin = await insertUserWithRole(t, "boss@example.com", ids.super_admin);
    const suspended = await t.run((ctx) =>
      ctx.db.insert("users", { email: "s@example.com", status: "suspended" }),
    );
    await migrate(t);
    expect((await t.run((ctx) => ctx.db.get("users", admin)))?.roleId).toBe(ids.super_admin);
    expect(await t.run((ctx) => ctx.db.get("users", suspended))).toMatchObject({
      roleId: ids.seller,
      status: "suspended",
    });
  });

  test("doesn't double count what was already counted live", async () => {
    const t = newTest();
    // Counted live (created through the app after the counters shipped)…
    const { userId } = await sellerWithShop(t, "new@example.com", { slug: "new-shop" });
    await as(t, userId).mutation(api.products.create, {
      name: "Robe",
      price: 2500,
      category: "clothes",
      sizes: [],
      colors: [],
      imageIds: [await storeFile(t)],
      soldOut: false,
    });
    // …plus legacy data that wasn't.
    const old = await legacyUser(t, "old@example.com");
    await legacyShop(t, old, "old-shop");
    await migrate(t);
    // The app-created user was inserted directly by the test helper, so it
    // is counted by the backfill only; shops/products must not be doubled.
    expect((await status(t)).totals).toEqual({ users: 2, shops: 2, products: 1, whatsappClicks: 0 });
  });

  test("works across many batches", async () => {
    const t = newTest();
    await t.run(async (ctx) => {
      for (let i = 0; i < 250; i++) await ctx.db.insert("users", { email: `u${i}@example.com` });
    });
    await migrate(t);
    const missing = await t.run(async (ctx) =>
      (await ctx.db.query("users").collect()).filter((u) => !u.roleId || !u.status),
    );
    expect(missing).toHaveLength(0);
    expect((await status(t)).totals.users).toBe(250);
  });

  test("runs once: a second run changes nothing", async () => {
    const t = newTest();
    await legacyUser(t, "old@example.com");
    expect((await status(t)).status).toBe("not_started");
    expect(await t.mutation(internal.migrations.rbacV1, {})).toBe("started");
    expect(await t.mutation(internal.migrations.rbacV1, {})).toBe("already_running");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await migrate(t)).toBe("already_done");
    expect((await status(t)).totals.users).toBe(1);
  });

  test("an existing seller can still edit their shop afterwards", async () => {
    const t = newTest();
    const userId = await legacyUser(t, "old@example.com");
    await legacyShop(t, userId, "old-shop");
    await migrate(t);
    await as(t, userId).mutation(api.shops.update, shopArgs({ slug: "old-shop", name: "Renamed" }));
    expect((await as(t, userId).query(api.shops.myShop, {}))?.name).toBe("Renamed");
  });
});
