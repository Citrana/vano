import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

const HOUR = 3_600_000;

const promoLook = (patch: Partial<NonNullable<StoredLook["overrides"]["promo"]>> = {}): StoredLook => ({
  v: 1,
  preset: "blush",
  overrides: {
    banner: { kind: "gradient", gradientId: "roseDusk", height: "sm" },
    promo: {
      design: { template: "sale", palette: "hotPink", font: "bold", headline: "Big sale", stickers: ["percentBurst"] },
      height: "md",
      ...patch,
    },
  },
});

const shownBanner = async (t: T) => {
  const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
  return page && !page.suspended ? page.shop.look.banner.kind : null;
};

describe("event & promo banners", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 19, 12));
  });
  afterEach(() => vi.useRealTimers());

  test("no dates: live from publish until removed", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: promoLook() });
    expect(await shownBanner(t)).toBe("gradient"); // a draft is never public
    await seller.mutation(api.shopLooks.publish, {});
    expect((await rowOf(t, shopId))?.promoLive).toBe(true);
    expect(await shownBanner(t)).toBe("event");
    const mine = await seller.query(api.shopLooks.mine, {});
    expect(mine).toMatchObject({ promoLive: true, promoEntitled: true, promoHiddenByPlan: false, language: "fr" });
  });

  test("scheduled: the normal banner until the start, the promo until the end, then back", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    const now = Date.now();
    await seller.mutation(api.shopLooks.saveDraft, { look: promoLook({ startsAt: now + HOUR, endsAt: now + 3 * HOUR }) });
    await seller.mutation(api.shopLooks.publish, {});
    expect((await rowOf(t, shopId))?.promoLive).toBe(false);
    expect(await shownBanner(t)).toBe("gradient");

    vi.advanceTimersByTime(HOUR);
    await t.finishInProgressScheduledFunctions();
    expect(await shownBanner(t)).toBe("event");

    vi.advanceTimersByTime(2 * HOUR);
    await t.finishInProgressScheduledFunctions();
    expect(await shownBanner(t)).toBe("gradient");
    // Still saved.
    expect((await seller.query(api.shopLooks.mine, {})).published?.overrides.promo?.design.headline).toBe("Big sale");
  });

  test("jobs from an older publish are harmless", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const seller = as(t, userId);
    const now = Date.now();
    await seller.mutation(api.shopLooks.saveDraft, { look: promoLook({ endsAt: now + HOUR }) });
    await seller.mutation(api.shopLooks.publish, {});
    // Republished without an end: the old end job must not hide it.
    await seller.mutation(api.shopLooks.saveDraft, { look: promoLook() });
    await seller.mutation(api.shopLooks.publish, {});
    vi.advanceTimersByTime(2 * HOUR);
    await t.finishInProgressScheduledFunctions();
    expect(await shownBanner(t)).toBe("event");
  });

  test("end now: back to the normal banner, kept saved, a later publish doesn't restart it", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: promoLook() });
    await seller.mutation(api.shopLooks.publish, {});
    await seller.mutation(api.shopLooks.saveDraft, { look: { ...promoLook(), preset: "lavender" } });
    await seller.mutation(api.shopLooks.endPromoNow, {});
    expect(await shownBanner(t)).toBe("gradient");
    const row = await rowOf(t, shopId);
    expect(row?.published?.overrides.promo?.endsAt).toBe(Date.now());
    expect(row?.draft?.overrides.promo?.endsAt).toBe(Date.now());
    await seller.mutation(api.shopLooks.publish, {});
    expect(await shownBanner(t)).toBe("gradient");
  });

  test("publish checks the plan and the dates", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    const now = Date.now();
    await seller.mutation(api.shopLooks.saveDraft, { look: promoLook({ startsAt: now + 400 * 24 * HOUR }) });
    await expect(seller.mutation(api.shopLooks.publish, {})).rejects.toThrow(/PROMO_SCHEDULE_INVALID/);
    await expect(
      seller.mutation(api.shopLooks.saveDraft, { look: promoLook({ startsAt: now + HOUR, endsAt: now }) }),
    ).rejects.toThrow(/LOOK_INVALID/);
    await expect(
      seller.mutation(api.shopLooks.saveDraft, { look: promoLook({}) }).then(() =>
        seller.mutation(api.shopLooks.saveDraft, {
          look: { ...promoLook(), overrides: { promo: { ...promoLook().overrides.promo!, design: { ...promoLook().overrides.promo!.design, stickers: ["mystery"] } } } },
        }),
      ),
    ).rejects.toThrow(/LOOK_INVALID/);

    // Free: the classic look with a promo is refused, the draft is kept.
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    await seller.mutation(api.shopLooks.saveDraft, { look: { ...FREE_LOOK, overrides: { promo: promoLook().overrides.promo } } });
    await expect(seller.mutation(api.shopLooks.publish, {})).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
    expect((await seller.query(api.shopLooks.mine, {})).editing.overrides.promo).toBeDefined();
  });

  test("a downgrade hides a live promo without deleting it; upgrading brings it back", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: promoLook() });
    await seller.mutation(api.shopLooks.publish, {});
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    expect(page && !page.suspended && page.shop.look.preset).toBe("classic");
    expect(await seller.query(api.shopLooks.mine, {})).toMatchObject({ promoHiddenByPlan: true, promoLive: true });
    await setSubscription(t, shopId, { plan: "pro", status: "active", periodEnd: Date.now() + 24 * HOUR });
    expect(await shownBanner(t)).toBe("event");
  });

  test("end now needs the owner and a published promo; suspended shops can't", async () => {
    const t = newTest();
    const a = await sellerWithShop(t);
    const b = await sellerWithShop(t, "b@shop.cd", { slug: "other-shop" });
    await as(t, a.userId).mutation(api.shopLooks.saveDraft, { look: promoLook() });
    await as(t, a.userId).mutation(api.shopLooks.publish, {});
    // B has nothing published: a no-op that never touches A.
    await as(t, b.userId).mutation(api.shopLooks.endPromoNow, {});
    expect(await shownBanner(t)).toBe("event");
    await expect(t.mutation(api.shopLooks.endPromoNow, {})).rejects.toThrow(/NOT_AUTHENTICATED/);
    await t.run((ctx) => ctx.db.patch("shops", a.shopId, { status: "suspended" }));
    await expect(as(t, a.userId).mutation(api.shopLooks.endPromoNow, {})).rejects.toThrow(/SHOP_SUSPENDED/);
  });
});

describe("button designs", () => {
  const designed: StoredLook = {
    v: 1,
    preset: "classic",
    overrides: { buttons: { shape: "rounded", fill: "solid", weight: "bold", design: "floral", decoration: "heart", label: "want" } },
  };

  test("saved, published and shown on the public page", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: designed });
    await seller.mutation(api.shopLooks.publish, {});
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    expect(page && !page.suspended && page.shop.look.buttons).toMatchObject({ design: "floral", decoration: "heart", label: "want" });
  });

  test("Free: Classic only (server-enforced); a downgrade shows Classic and keeps the choice", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: designed });
    await seller.mutation(api.shopLooks.publish, {});
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    expect(page && !page.suspended && page.shop.look.buttons).toMatchObject({ design: "classic", decoration: "none", label: "order" });
    expect((await seller.query(api.shopLooks.mine, {})).published?.overrides.buttons?.design).toBe("floral");

    await seller.mutation(api.shopLooks.saveDraft, {
      look: { ...designed, overrides: { buttons: { ...designed.overrides.buttons!, design: "glow" } } },
    });
    await expect(seller.mutation(api.shopLooks.publish, {})).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
  });
});
