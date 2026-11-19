import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { FREE_LOOK, presetLook } from "./lib/looks/presets";
import type { StoredLook } from "./lib/looks/validators";
import { as, newTest, sellerWithShop, setSubscription, storeFile, type T } from "./lib/test.utils";

const fileExists = (t: T, id: Id<"_storage">) => t.run(async (ctx) => (await ctx.db.system.get("_storage", id)) !== null);

const photoLook = (imageId: Id<"_storage">, text?: string): StoredLook => ({
  v: 1,
  preset: "blush",
  overrides: {
    banner: {
      kind: "photo",
      imageId,
      focusX: 50,
      focusY: 40,
      zoom: 1.2,
      height: "md",
      ...(text ? { text: { value: text, align: "center" as const } } : {}),
    },
  },
});

const rowOf = (t: T, shopId: Id<"shops">) =>
  t.run((ctx) => ctx.db.query("shopLooks").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique());

describe("shopLooks.mine", () => {
  test("a new shop edits the free look, nothing published", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const mine = await as(t, userId).query(api.shopLooks.mine, {});
    expect(mine).toMatchObject({
      slug: "chez-amani",
      editing: FREE_LOOK,
      published: null,
      hasUnpublishedChanges: false,
      entitled: true, // trial
      hiddenByPlan: false,
    });
  });

  test("signed out and shopless callers are refused", async () => {
    const t = newTest();
    await expect(t.query(api.shopLooks.mine, {})).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});

describe("shopLooks.saveDraft / publish / discardDraft", () => {
  test("draft → publish makes it live and clears the draft", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: presetLook("lavender") });
    let mine = await seller.query(api.shopLooks.mine, {});
    expect(mine.editing.preset).toBe("lavender");
    expect(mine.hasUnpublishedChanges).toBe(true);
    expect(mine.published).toBeNull();

    await seller.mutation(api.shopLooks.publish, {});
    mine = await seller.query(api.shopLooks.mine, {});
    expect(mine.published?.preset).toBe("lavender");
    expect(mine.hasUnpublishedChanges).toBe(false);
    expect((await rowOf(t, shopId))?.draft).toBeUndefined();
  });

  test("publish without a draft is refused", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    await expect(as(t, userId).mutation(api.shopLooks.publish, {})).rejects.toThrow(/LOOK_NO_DRAFT/);
  });

  test("bad values are refused", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const bad: StoredLook = { v: 1, preset: "blush", overrides: { colors: { accent: "pink", background: "#ffffff" } } };
    await expect(as(t, userId).mutation(api.shopLooks.saveDraft, { look: bad })).rejects.toThrow(/LOOK_INVALID/);
    const imageId = await storeFile(t);
    await expect(
      as(t, userId).mutation(api.shopLooks.saveDraft, { look: photoLook(imageId, "x".repeat(61)) }),
    ).rejects.toThrow(/LOOK_INVALID/);
  });

  test("a blocking contrast problem can be saved but not published", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const seller = as(t, userId);
    const look: StoredLook = { v: 1, preset: "blush", overrides: { colors: { accent: "#1a1412", background: "#8a7f86" } } };
    await seller.mutation(api.shopLooks.saveDraft, { look });
    await expect(seller.mutation(api.shopLooks.publish, {})).rejects.toThrow(/LOOK_CONTRAST/);
  });

  test("Free plan: drafts are kept, only the free look can be published", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: presetLook("noir") });
    await expect(seller.mutation(api.shopLooks.publish, {})).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
    expect((await seller.query(api.shopLooks.mine, {})).editing.preset).toBe("noir");

    await seller.mutation(api.shopLooks.saveDraft, { look: FREE_LOOK });
    await seller.mutation(api.shopLooks.publish, {});
    expect((await seller.query(api.shopLooks.mine, {})).published).toEqual(FREE_LOOK);
  });

  test("a downgraded shop keeps its published design, flagged as hidden", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: presetLook("sunset") });
    await seller.mutation(api.shopLooks.publish, {});
    await setSubscription(t, shopId, { plan: "free", status: "expired" });
    const mine = await seller.query(api.shopLooks.mine, {});
    expect(mine.published?.preset).toBe("sunset");
    expect(mine).toMatchObject({ entitled: false, hiddenByPlan: true });
  });

  test("a suspended shop is read-only", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    await expect(as(t, userId).mutation(api.shopLooks.saveDraft, { look: presetLook("blush") })).rejects.toThrow(
      /SHOP_SUSPENDED/,
    );
  });

  test("each seller only touches their own look", async () => {
    const t = newTest();
    const a = await sellerWithShop(t, "a@example.com", { slug: "shop-a" });
    const b = await sellerWithShop(t, "b@example.com", { slug: "shop-b" });
    await as(t, a.userId).mutation(api.shopLooks.saveDraft, { look: presetLook("ocean") });
    expect((await as(t, b.userId).query(api.shopLooks.mine, {})).editing).toEqual(FREE_LOOK);
    await as(t, b.userId).mutation(api.shopLooks.discardDraft, {});
    expect((await rowOf(t, a.shopId))?.draft?.preset).toBe("ocean");
  });
});

describe("banner photos", () => {
  test("another seller's photo can't be attached", async () => {
    const t = newTest();
    const a = await sellerWithShop(t, "a@example.com", { slug: "shop-a" });
    const b = await sellerWithShop(t, "b@example.com", { slug: "shop-b" });
    const imageId = await storeFile(t);
    await as(t, a.userId).mutation(api.shopLooks.saveDraft, { look: photoLook(imageId) });
    await expect(as(t, b.userId).mutation(api.shopLooks.saveDraft, { look: photoLook(imageId) })).rejects.toThrow(
      /IMAGE_INVALID/,
    );
  });

  test("non-images and oversized files are refused", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const pdf = await storeFile(t, { type: "application/pdf" });
    const huge = await storeFile(t, { size: 2_000_000 });
    for (const id of [pdf, huge]) {
      await expect(as(t, userId).mutation(api.shopLooks.saveDraft, { look: photoLook(id) })).rejects.toThrow(
        /IMAGE_INVALID/,
      );
    }
  });

  test("replaced draft photos are deleted; the published one is kept until replaced", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const seller = as(t, userId);
    const first = await storeFile(t);
    const second = await storeFile(t);
    const third = await storeFile(t);

    await seller.mutation(api.shopLooks.saveDraft, { look: photoLook(first) });
    await seller.mutation(api.shopLooks.publish, {});
    // Draft swaps photos twice: the in-between one goes, the published one stays.
    await seller.mutation(api.shopLooks.saveDraft, { look: photoLook(second) });
    await seller.mutation(api.shopLooks.saveDraft, { look: photoLook(third) });
    expect(await fileExists(t, first)).toBe(true);
    expect(await fileExists(t, second)).toBe(false);
    expect(await fileExists(t, third)).toBe(true);

    const mine = await seller.query(api.shopLooks.mine, {});
    expect(Object.keys(mine.bannerUrls).sort()).toEqual([first, third].sort());

    await seller.mutation(api.shopLooks.publish, {});
    expect(await fileExists(t, first)).toBe(false);
    expect(await fileExists(t, third)).toBe(true);
  });

  test("discarding deletes a photo only the draft used", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const seller = as(t, userId);
    const published = await storeFile(t);
    const draftOnly = await storeFile(t);
    await seller.mutation(api.shopLooks.saveDraft, { look: photoLook(published) });
    await seller.mutation(api.shopLooks.publish, {});
    await seller.mutation(api.shopLooks.saveDraft, { look: photoLook(draftOnly) });
    await seller.mutation(api.shopLooks.discardDraft, {});
    expect(await fileExists(t, draftOnly)).toBe(false);
    expect(await fileExists(t, published)).toBe(true);
    expect((await seller.query(api.shopLooks.mine, {})).editing.overrides.banner).toMatchObject({ imageId: published });
  });
});
