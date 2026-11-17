import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  productArgs,
  sellerWithShop,
  shopArgs,
} from "./lib/test.utils";

/**
 * Seller functions on the permission system (CLAUDE.md "Roles &
 * permissions"): each declares a permission, suspended users are rejected,
 * and the ownership rules are unchanged (see products.test.ts).
 */

const modules = import.meta.glob("./**/*.*s");
const setup = () => convexTest(schema, modules);

describe("seller permissions", () => {
  test("a user with the seller role can use every seller function", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const userId = await insertUserWithRole(t, "s@x.com", ids.seller);
    const me = as(t, userId);
    await me.mutation(api.shops.create, shopArgs());
    await me.mutation(api.products.create, await productArgs(t));
    expect(await me.query(api.products.listMine, {})).toHaveLength(1);
    expect(await me.query(api.stats.summary, { today: "2026-11-17" })).toMatchObject({
      last7: { shopViews: 0 },
    });
    expect(typeof (await me.mutation(api.files.generateUploadUrl, {}))).toBe("string");
  });

  test("a user not migrated yet (no role) is treated as a seller", async () => {
    const t = setup();
    const { userId } = await sellerWithShop(t);
    expect(await as(t, userId).query(api.shops.myShop, {})).not.toBeNull();
  });

  test("a super admin can open their own shop", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const userId = await insertUserWithRole(t, "a@x.com", ids.super_admin);
    await as(t, userId).mutation(api.shops.create, shopArgs());
    expect((await as(t, userId).query(api.shops.myShop, {}))?.ownerId).toBe(userId);
  });

  test("a custom role without the permission gets FORBIDDEN", async () => {
    const t = setup();
    await builtInRoles(t);
    const support = await insertRole(t, "Support", ["users.view"]);
    const userId = await insertUserWithRole(t, "support@x.com", support);
    const me = as(t, userId);
    await expect(me.mutation(api.shops.create, shopArgs())).rejects.toThrow(/FORBIDDEN/);
    await expect(me.query(api.products.listMine, {})).rejects.toThrow(/FORBIDDEN/);
    await expect(me.query(api.stats.summary, { today: "2026-11-17" })).rejects.toThrow(/FORBIDDEN/);
    await expect(me.mutation(api.files.generateUploadUrl, {})).rejects.toThrow(/FORBIDDEN/);
  });

  test("upload URL needs either own-shop or own-products permission", async () => {
    const t = setup();
    await builtInRoles(t);
    const productsOnly = await insertRole(t, "Catalog", ["ownProducts.manage"]);
    const userId = await insertUserWithRole(t, "c@x.com", productsOnly);
    expect(typeof (await as(t, userId).mutation(api.files.generateUploadUrl, {}))).toBe("string");
    await expect(as(t, userId).mutation(api.shops.create, shopArgs())).rejects.toThrow(/FORBIDDEN/);
  });

  test("a suspended user is rejected by queries and mutations", async () => {
    const t = setup();
    const { userId } = await sellerWithShop(t);
    await t.run((ctx) => ctx.db.patch("users", userId, { status: "suspended" }));
    const me = as(t, userId);
    await expect(me.query(api.shops.myShop, {})).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    await expect(me.query(api.products.listMine, {})).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    await expect(me.mutation(api.shops.update, shopArgs())).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    await expect(me.mutation(api.files.generateUploadUrl, {})).rejects.toThrow(/ACCOUNT_SUSPENDED/);
  });
});

describe("suspended shop", () => {
  test("is read-only for its seller", async () => {
    const t = setup();
    const { userId, shopId } = await sellerWithShop(t);
    const me = as(t, userId);
    const productId = await me.mutation(api.products.create, await productArgs(t));
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));

    // Reads still work.
    expect((await me.query(api.shops.myShop, {}))?.status).toBe("suspended");
    expect(await me.query(api.products.listMine, {})).toHaveLength(1);
    await me.query(api.stats.summary, { today: "2026-11-17" });

    // Every write is refused.
    await expect(me.mutation(api.shops.update, shopArgs())).rejects.toThrow(/SHOP_SUSPENDED/);
    await expect(me.mutation(api.products.create, await productArgs(t))).rejects.toThrow(
      /SHOP_SUSPENDED/,
    );
    await expect(
      me.mutation(api.products.update, { productId, ...(await productArgs(t)) }),
    ).rejects.toThrow(/SHOP_SUSPENDED/);
    await expect(
      me.mutation(api.products.setSoldOut, { productId, soldOut: true }),
    ).rejects.toThrow(/SHOP_SUSPENDED/);
    await expect(me.mutation(api.products.remove, { productId })).rejects.toThrow(/SHOP_SUSPENDED/);
    await expect(me.mutation(api.files.generateUploadUrl, {})).rejects.toThrow(/SHOP_SUSPENDED/);
  });

  test("doesn't affect other sellers", async () => {
    const t = setup();
    const { shopId } = await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
    const { userId: other } = await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    await as(t, other).mutation(api.products.create, await productArgs(t));
  });
});
