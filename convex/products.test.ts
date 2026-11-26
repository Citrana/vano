import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, insertUser, productArgs, sellerWithShop, setSubscription, storeFile, newTest } from "./lib/test.utils";

const setup = newTest;

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
  test("update keeps the admin-controlled hidden flag", async () => {
    const t = setup();
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    const productId = await me.mutation(api.products.create, await productArgs(t));
    await t.run((ctx) => ctx.db.patch("products", productId, { hidden: true }));
    await me.mutation(api.products.update, { productId, ...(await productArgs(t)), name: "Renamed" });
    expect(await t.run((ctx) => ctx.db.get("products", productId))).toMatchObject({
      name: "Renamed",
      hidden: true,
    });
  });

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

describe("product details: pieces, cost price, condition, audience, code", () => {
  test("pieces and cost price are required (validator), cost 0 is fine, bad values are refused", async () => {
    const { t, a } = await twoSellers();
    const noPieces: Record<string, unknown> = await productArgs(t);
    delete noPieces.pieces;
    const noCost: Record<string, unknown> = await productArgs(t);
    delete noCost.costPrice;
    await expect(a.mutation(api.products.create, noPieces as never)).rejects.toThrow();
    await expect(a.mutation(api.products.create, noCost as never)).rejects.toThrow();
    await expect(a.mutation(api.products.create, await productArgs(t, { costPrice: -1 }))).rejects.toThrow(/COST_PRICE_INVALID/);
    await expect(a.mutation(api.products.create, await productArgs(t, { costPrice: 1.5 }))).rejects.toThrow(/COST_PRICE_INVALID/);
    const id = await a.mutation(api.products.create, await productArgs(t, { costPrice: 0, pieces: 1 }));
    expect(await a.query(api.products.getMine, { productId: id })).toMatchObject({ costPrice: 0, pieces: 1 });
  });

  test("condition, audience and code are optional and saved; the code is normalised", async () => {
    const { t, a } = await twoSellers();
    const plain = await a.mutation(api.products.create, await productArgs(t));
    const row = await t.run((ctx) => ctx.db.get("products", plain));
    expect([row?.condition, row?.audience, row?.code]).toEqual([undefined, undefined, undefined]);
    const id = await a.mutation(
      api.products.create,
      await productArgs(t, { condition: "thrift", audience: "kids", code: " clo 7 " }),
    );
    expect(await a.query(api.products.getMine, { productId: id })).toMatchObject({ condition: "thrift", audience: "kids", code: "CLO-7" });
    expect((await a.query(api.products.listMine, {}))[0]).toMatchObject({ code: "CLO-7" });
    await expect(a.mutation(api.products.create, await productArgs(t, { code: "x" }))).rejects.toThrow(/PRODUCT_CODE_INVALID/);
    // An empty code means none.
    const empty = await a.mutation(api.products.create, await productArgs(t, { code: "  " }));
    expect((await t.run((ctx) => ctx.db.get("products", empty)))!.code).toBeUndefined();
  });

  test("codes are unique per shop (any case); a product keeps its own code; other shops may reuse it", async () => {
    const { t, a, b } = await twoSellers();
    const first = await a.mutation(api.products.create, await productArgs(t, { code: "CLO-001" }));
    await expect(a.mutation(api.products.create, await productArgs(t, { code: "clo-001" }))).rejects.toThrow(/PRODUCT_CODE_TAKEN/);
    await a.mutation(api.products.update, { productId: first, ...(await productArgs(t, { code: "CLO-001", name: "Renamed" })) });
    const second = await a.mutation(api.products.create, await productArgs(t, { code: "CLO-002" }));
    await expect(
      a.mutation(api.products.update, { productId: second, ...(await productArgs(t, { code: "CLO-001" })) }),
    ).rejects.toThrow(/PRODUCT_CODE_TAKEN/);
    await b.mutation(api.products.create, await productArgs(t, { code: "CLO-001" }));
  });

  test("suggestCode gives the next free code for the category, in the caller's shop only", async () => {
    const { t, a, b } = await twoSellers();
    expect(await a.query(api.products.suggestCode, { category: "clothes" })).toBe("CLO-001");
    await a.mutation(api.products.create, await productArgs(t, { code: "CLO-001" }));
    await a.mutation(api.products.create, await productArgs(t, { code: "CLO-004" }));
    expect(await a.query(api.products.suggestCode, { category: "clothes" })).toBe("CLO-005");
    expect(await a.query(api.products.suggestCode, { category: "shoes" })).toBe("SHO-001");
    expect(await b.query(api.products.suggestCode, { category: "clothes" })).toBe("CLO-001");
    await expect(t.query(api.products.suggestCode, { category: "clothes" })).rejects.toThrow(/NOT_AUTHENTICATED/);
  });

  test("an older product without pieces or cost still shows and lists; saving it needs both", async () => {
    const { t, a } = await twoSellers();
    const id = await a.mutation(api.products.create, await productArgs(t, { name: "Old dress" }));
    await t.run((ctx) => ctx.db.patch("products", id, { pieces: undefined, costPrice: undefined }));
    const page = await t.query(api.public.shopBySlug, { slug: "shop-a" });
    if (!page || page.suspended) throw new Error("no shop");
    expect(page.products.map((p) => p.name)).toEqual(["Old dress"]);
    expect((await a.query(api.products.listMine, {}))[0]).toMatchObject({ pieces: null });
    const rest: Record<string, unknown> = await productArgs(t);
    delete rest.pieces;
    delete rest.costPrice;
    await expect(a.mutation(api.products.update, { productId: id, ...rest } as never)).rejects.toThrow();
    await a.mutation(api.products.update, { productId: id, ...(await productArgs(t, { pieces: 0, costPrice: 900 })) });
    expect(await t.run((ctx) => ctx.db.get("products", id))).toMatchObject({ pieces: 0, costPrice: 900 });
  });

  test("the cost price is only for people who can edit products, and never public", async () => {
    const t = setup();
    const owner = await sellerWithShop(t, "owner@x.com", { slug: "shop-a" });
    await setSubscription(t, owner.shopId, { plan: "business", status: "active", periodEnd: Date.now() + 60 * 86_400_000 });
    const me = as(t, owner.userId);
    const id = await me.mutation(
      api.products.create,
      await productArgs(t, { costPrice: 987_653, condition: "new", audience: "women", code: "CLO-001" }),
    );
    expect((await me.query(api.products.getMine, { productId: id }))?.costPrice).toBe(987_653);

    // A team "Seller" sees products but can't edit them: no cost price.
    const { token } = await me.mutation(api.team.createInvite, { role: "seller", language: "en" });
    const memberId = await insertUser(t, "member@x.com");
    await as(t, memberId).mutation(api.team.acceptInvite, { token });
    const asMember = await as(t, memberId).query(api.products.getMine, { productId: id });
    expect(asMember).not.toBeNull();
    expect(asMember?.costPrice).toBeUndefined();
    await expect(as(t, memberId).query(api.products.suggestCode, { category: "clothes" })).rejects.toThrow(/FORBIDDEN/);

    // Public queries carry the details, never the cost.
    const page = await t.query(api.public.shopBySlug, { slug: "shop-a" });
    if (!page || page.suspended) throw new Error("no shop");
    expect(page.products[0]).toMatchObject({ condition: "new", audience: "women", code: "CLO-001" });
    expect(page.products[0]).not.toHaveProperty("costPrice");
    const product = await t.query(api.public.productForPage, { slug: "shop-a", productId: id });
    if (!product || product.suspended) throw new Error("no product");
    expect(product.product).toMatchObject({ condition: "new", audience: "women", code: "CLO-001" });
    expect(JSON.stringify(product)).not.toContain("987653");
    expect(JSON.stringify(page)).not.toContain("costPrice");
  });
});

