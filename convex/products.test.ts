import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { as, insertUser, productArgs, sellerWithShop, storeFile } from "./lib/test.utils";

const modules = import.meta.glob("./**/*.*s");
const setup = () => convexTest(schema, modules);

async function twoSellers() {
  const t = setup();
  const a = await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
  const b = await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
  return { t, a: as(t, a.userId), b: as(t, b.userId) };
}

const fileExists = (t: ReturnType<typeof setup>, id: Id<"_storage">) =>
  t.run(async (ctx) => (await ctx.db.system.get("_storage", id)) !== null);

describe("products.create", () => {
  test("requires sign-in and a shop", async () => {
    const t = setup();
    await expect(t.mutation(api.products.create, await productArgs(t))).rejects.toThrow(/NOT_AUTHENTICATED/);
    const noShop = as(t, await insertUser(t));
    await expect(noShop.mutation(api.products.create, await productArgs(t))).rejects.toThrow(/NO_SHOP/);
  });

  test("creates and lists newest first, cleaning tags", async () => {
    const { t, a } = await twoSellers();
    await a.mutation(api.products.create, await productArgs(t, { name: "First" }));
    await a.mutation(
      api.products.create,
      await productArgs(t, { name: " Second ", sizes: [" M", "m", "L"] }),
    );
    const list = await a.query(api.products.listMine, {});
    expect(list.map((p) => p.name)).toEqual(["Second", "First"]);
    expect(list[0].coverUrl).toEqual(expect.any(String));
    const full = await a.query(api.products.getMine, { productId: list[0]._id });
    expect(full?.sizes).toEqual(["M", "L"]);
  });

  test("category must be one of the shop's categories", async () => {
    const { t, a } = await twoSellers();
    await expect(
      a.mutation(api.products.create, await productArgs(t, { category: "bags" })),
    ).rejects.toThrow(/CATEGORY_NOT_IN_SHOP/);
  });

  test("validates price, name, tags", async () => {
    const { t, a } = await twoSellers();
    await expect(a.mutation(api.products.create, await productArgs(t, { price: 0 }))).rejects.toThrow(/PRICE_INVALID/);
    await expect(a.mutation(api.products.create, await productArgs(t, { price: 10.5 }))).rejects.toThrow(/PRICE_INVALID/);
    await expect(a.mutation(api.products.create, await productArgs(t, { name: "x" }))).rejects.toThrow(/NAME_INVALID/);
    await expect(
      a.mutation(api.products.create, await productArgs(t, { colors: ["x".repeat(21)] })),
    ).rejects.toThrow(/TAGS_INVALID/);
  });

  test("needs 1 to 6 valid images", async () => {
    const { t, a } = await twoSellers();
    await expect(a.mutation(api.products.create, await productArgs(t, { imageIds: [] }))).rejects.toThrow(/IMAGES_COUNT/);
    const seven = await Promise.all(Array.from({ length: 7 }, () => storeFile(t)));
    await expect(a.mutation(api.products.create, await productArgs(t, { imageIds: seven }))).rejects.toThrow(/IMAGES_COUNT/);
    await a.mutation(api.products.create, await productArgs(t, { imageIds: seven.slice(0, 6) }));
    const big = await storeFile(t, { size: 2_000_000 });
    await expect(a.mutation(api.products.create, await productArgs(t, { imageIds: [big] }))).rejects.toThrow(/IMAGE_INVALID/);
    const txt = await storeFile(t, { type: "text/plain" });
    await expect(a.mutation(api.products.create, await productArgs(t, { imageIds: [txt] }))).rejects.toThrow(/IMAGE_INVALID/);
  });

  test("cannot attach another seller's image", async () => {
    const { t, a, b } = await twoSellers();
    const args = await productArgs(t);
    await a.mutation(api.products.create, args);
    await expect(
      b.mutation(api.products.create, await productArgs(t, { imageIds: args.imageIds })),
    ).rejects.toThrow(/IMAGE_INVALID/);
  });
});

describe("ownership", () => {
  test("another seller cannot read, edit, toggle or delete my product", async () => {
    const { t, a, b } = await twoSellers();
    const args = await productArgs(t);
    const productId = await a.mutation(api.products.create, args);

    expect(await b.query(api.products.getMine, { productId })).toBeNull();
    expect(await b.query(api.products.listMine, {})).toEqual([]);
    await expect(
      b.mutation(api.products.update, { productId, ...(await productArgs(t)) }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(b.mutation(api.products.setSoldOut, { productId, soldOut: true })).rejects.toThrow(/NOT_FOUND/);
    await expect(b.mutation(api.products.remove, { productId })).rejects.toThrow(/NOT_FOUND/);

    const mine = await a.query(api.products.getMine, { productId });
    expect(mine).toMatchObject({ soldOut: false, name: "Robe wax" });
  });

  test("getMine returns null for a malformed id", async () => {
    const { a } = await twoSellers();
    expect(await a.query(api.products.getMine, { productId: "not-an-id" })).toBeNull();
  });
});

describe("products.update / setSoldOut / remove", () => {
  test("update deletes images removed from the list", async () => {
    const { t, a } = await twoSellers();
    const [keep, drop] = [await storeFile(t), await storeFile(t)];
    const productId = await a.mutation(api.products.create, await productArgs(t, { imageIds: [keep, drop] }));
    const added = await storeFile(t);
    await a.mutation(api.products.update, {
      productId,
      ...(await productArgs(t, { imageIds: [added, keep], price: 9900 })),
    });
    expect(await fileExists(t, drop)).toBe(false);
    expect(await fileExists(t, keep)).toBe(true);
    const product = await a.query(api.products.getMine, { productId });
    expect(product?.imageIds).toEqual([added, keep]);
    expect(product?.price).toBe(9900);
  });

  test("setSoldOut toggles", async () => {
    const { t, a } = await twoSellers();
    const productId = await a.mutation(api.products.create, await productArgs(t));
    await a.mutation(api.products.setSoldOut, { productId, soldOut: true });
    expect((await a.query(api.products.listMine, {}))[0].soldOut).toBe(true);
  });

  test("remove deletes product, images, upload rows and stats", async () => {
    const { t, a } = await twoSellers();
    const args = await productArgs(t);
    const productId = await a.mutation(api.products.create, args);
    await t.mutation(api.stats.recordProductView, { productId });
    await a.mutation(api.products.remove, { productId });
    expect(await a.query(api.products.listMine, {})).toEqual([]);
    expect(await fileExists(t, args.imageIds[0])).toBe(false);
    const leftovers = await t.run(async (ctx) => ({
      uploads: await ctx.db.query("uploads").collect(),
      stats: await ctx.db.query("productDailyStats").collect(),
    }));
    expect(leftovers).toEqual({ uploads: [], stats: [] });
  });
});
