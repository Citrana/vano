import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import {
  as,
  insertUser,
  productArgs,
  sellerWithShop,
  shopArgs,
  storeFile,
} from "./lib/test.utils";

const modules = import.meta.glob("./**/*.*s");
const setup = () => convexTest(schema, modules);

describe("users.viewer", () => {
  test("null when signed out, hasShop after onboarding", async () => {
    const t = setup();
    expect(await t.query(api.users.viewer, {})).toBeNull();
    const userId = await insertUser(t);
    expect(await as(t, userId).query(api.users.viewer, {})).toEqual({
      email: "seller@example.com",
      hasShop: false,
    });
    await as(t, userId).mutation(api.shops.create, shopArgs());
    expect((await as(t, userId).query(api.users.viewer, {}))?.hasShop).toBe(true);
  });
});

describe("shops.create", () => {
  test("rejects unauthenticated callers", async () => {
    const t = setup();
    await expect(t.mutation(api.shops.create, shopArgs())).rejects.toThrow(/NOT_AUTHENTICATED/);
  });

  test("creates a shop with a normalized phone and trimmed fields", async () => {
    const t = setup();
    const userId = await insertUser(t);
    await as(t, userId).mutation(
      api.shops.create,
      shopArgs({ name: "  Chez Amani ", whatsappNumber: "0812345678", country: "cd" }),
    );
    const shop = await as(t, userId).query(api.shops.myShop, {});
    expect(shop).toMatchObject({
      name: "Chez Amani",
      whatsappNumber: "+243812345678",
      country: "CD",
      ownerId: userId,
      logoUrl: null,
    });
  });

  test("one shop per user", async () => {
    const t = setup();
    const { userId } = await sellerWithShop(t);
    await expect(
      as(t, userId).mutation(api.shops.create, shopArgs({ slug: "another" })),
    ).rejects.toThrow(/SHOP_EXISTS/);
  });

  test("slug must be valid, not reserved and unique", async () => {
    const t = setup();
    await sellerWithShop(t, "a@x.com", { slug: "taken-slug" });
    const userId = await insertUser(t, "b@x.com");
    const me = as(t, userId);
    await expect(me.mutation(api.shops.create, shopArgs({ slug: "ab" }))).rejects.toThrow(/SLUG_INVALID/);
    await expect(me.mutation(api.shops.create, shopArgs({ slug: "Bad Slug" }))).rejects.toThrow(/SLUG_INVALID/);
    await expect(me.mutation(api.shops.create, shopArgs({ slug: "dashboard" }))).rejects.toThrow(/SLUG_RESERVED/);
    await expect(me.mutation(api.shops.create, shopArgs({ slug: "taken-slug" }))).rejects.toThrow(/SLUG_TAKEN/);
  });

  test("validates phone, categories, name, city, country", async () => {
    const t = setup();
    const me = as(t, await insertUser(t));
    await expect(me.mutation(api.shops.create, shopArgs({ whatsappNumber: "123" }))).rejects.toThrow(/PHONE_INVALID/);
    await expect(me.mutation(api.shops.create, shopArgs({ categories: [] }))).rejects.toThrow(/CATEGORIES_REQUIRED/);
    await expect(me.mutation(api.shops.create, shopArgs({ name: " a " }))).rejects.toThrow(/NAME_INVALID/);
    await expect(me.mutation(api.shops.create, shopArgs({ city: "  " }))).rejects.toThrow(/CITY_INVALID/);
    await expect(me.mutation(api.shops.create, shopArgs({ country: "XX" }))).rejects.toThrow(/COUNTRY_INVALID/);
    await expect(
      me.mutation(api.shops.create, shopArgs({ description: "x".repeat(301) })),
    ).rejects.toThrow(/DESCRIPTION_TOO_LONG/);
  });

  test("logo must be an image", async () => {
    const t = setup();
    const me = as(t, await insertUser(t));
    const pdf = await storeFile(t, { type: "application/pdf" });
    await expect(me.mutation(api.shops.create, shopArgs({ logoId: pdf }))).rejects.toThrow(/IMAGE_INVALID/);
    const logo = await storeFile(t);
    await me.mutation(api.shops.create, shopArgs({ logoId: logo }));
    expect((await me.query(api.shops.myShop, {}))?.logoUrl).toEqual(expect.any(String));
  });

  test("cannot use another seller's file as logo", async () => {
    const t = setup();
    const logo = await storeFile(t);
    await sellerWithShop(t, "a@x.com", { slug: "shop-a", logoId: logo });
    const other = as(t, await insertUser(t, "b@x.com"));
    await expect(
      other.mutation(api.shops.create, shopArgs({ slug: "shop-b", logoId: logo })),
    ).rejects.toThrow(/IMAGE_INVALID/);
  });
});

describe("shops.checkSlug", () => {
  test("reports problems, taken slugs, and accepts your own", async () => {
    const t = setup();
    const { userId } = await sellerWithShop(t, "a@x.com", { slug: "mine" });
    expect(await t.query(api.shops.checkSlug, { slug: "free-one" })).toEqual({ ok: true });
    expect(await t.query(api.shops.checkSlug, { slug: "ab" })).toEqual({ ok: false, problem: "length" });
    expect(await t.query(api.shops.checkSlug, { slug: "a_b_c" })).toEqual({ ok: false, problem: "format" });
    expect(await t.query(api.shops.checkSlug, { slug: "login" })).toEqual({ ok: false, problem: "reserved" });
    expect(await t.query(api.shops.checkSlug, { slug: "mine" })).toEqual({ ok: false, problem: "taken" });
    expect(await as(t, userId).query(api.shops.checkSlug, { slug: "mine" })).toEqual({ ok: true });
  });
});

describe("shops.update", () => {
  test("requires a shop", async () => {
    const t = setup();
    const me = as(t, await insertUser(t));
    await expect(me.mutation(api.shops.update, shopArgs())).rejects.toThrow(/NO_SHOP/);
  });

  test("changes slug, keeps own slug, rejects a taken one", async () => {
    const t = setup();
    await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
    const { userId } = await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
    const me = as(t, userId);
    await me.mutation(api.shops.update, shopArgs({ slug: "shop-b", name: "Renamed" }));
    await expect(me.mutation(api.shops.update, shopArgs({ slug: "shop-a" }))).rejects.toThrow(/SLUG_TAKEN/);
    await me.mutation(api.shops.update, shopArgs({ slug: "shop-b2" }));
    const shop = await me.query(api.shops.myShop, {});
    expect(shop).toMatchObject({ slug: "shop-b2", ownerId: userId });
  });

  test("replacing or removing the logo deletes the old file", async () => {
    const t = setup();
    const first = await storeFile(t);
    const { userId } = await sellerWithShop(t, "a@x.com", { logoId: first });
    const me = as(t, userId);
    const second = await storeFile(t);
    await me.mutation(api.shops.update, shopArgs({ logoId: second }));
    expect(await t.run((ctx) => ctx.db.system.get("_storage", first))).toBeNull();
    await me.mutation(api.shops.update, shopArgs());
    expect(await t.run((ctx) => ctx.db.system.get("_storage", second))).toBeNull();
    expect((await me.query(api.shops.myShop, {}))?.logoId).toBeUndefined();
  });

  test("cannot remove a category still used by a product", async () => {
    const t = setup();
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    await me.mutation(api.products.create, await productArgs(t, { category: "shoes" }));
    await expect(
      me.mutation(api.shops.update, shopArgs({ categories: ["clothes"] })),
    ).rejects.toThrow(/CATEGORY_IN_USE/);
    await me.mutation(api.shops.update, shopArgs({ categories: ["shoes", "bags"] }));
  });
});

describe("files.generateUploadUrl", () => {
  test("requires sign-in", async () => {
    const t = setup();
    await expect(t.mutation(api.files.generateUploadUrl, {})).rejects.toThrow(/NOT_AUTHENTICATED/);
    const me = as(t, await insertUser(t));
    expect(await me.mutation(api.files.generateUploadUrl, {})).toEqual(expect.any(String));
  });
});
