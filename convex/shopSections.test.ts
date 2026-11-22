import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { FREE_LOOK } from "./lib/looks/presets";
import { DEFAULT_SECTIONS, type SectionsFacet } from "./lib/looks/sections";
import type { StoredLook } from "./lib/looks/validators";
import { RESTOCK_MS } from "./lib/restock";
import {
  as,
  builtInRoles,
  insertUserWithRole,
  newTest,
  productArgs,
  sellerWithShop,
  setSubscription,
  settingsArgs,
  type T,
} from "./lib/test.utils";

/**
 * Shop sections, product layout, announcement bar, About and contact and
 * the product flags behind them (CLAUDE.md "Shop looks").
 */

const DAY_MS = 86_400_000;

const sections = (extra: Partial<SectionsFacet> = {}): SectionsFacet => ({
  ...DEFAULT_SECTIONS,
  order: DEFAULT_SECTIONS.order.map((e) => (e.id === "featured" ? { ...e, on: true } : e)),
  layout: "grid3",
  ...extra,
});

const withParts = (parts: StoredLook["overrides"]): StoredLook => ({ ...FREE_LOOK, overrides: parts });
const bar = { text: "Free delivery in Goma this weekend", tone: "accent" as const };

const rowOf = (t: T, shopId: Id<"shops">) =>
  t.run((ctx) => ctx.db.query("shopLooks").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique());

async function publicLook(t: T) {
  const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
  if (!page || page.suspended) throw new Error("no page");
  return page.shop.look;
}

describe("sections and layout", () => {
  test("Pro (trial): saved, published and shown on the public page", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: withParts({ sections: sections() }) });
    expect((await publicLook(t)).sections).toEqual(DEFAULT_SECTIONS); // a draft is never public
    await seller.mutation(api.shopLooks.publish, {});
    expect((await publicLook(t)).sections).toEqual(sections());
    expect(await seller.query(api.shopLooks.mine, {})).toMatchObject({ sectionsEntitled: true, sectionsHiddenByPlan: false });
  });

  test("Free: All products in 2 columns and the About switch only (server-enforced)", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    const seller = as(t, userId);
    for (const look of [withParts({ sections: sections() }), withParts({ sections: { ...DEFAULT_SECTIONS, layout: "large" } })]) {
      await seller.mutation(api.shopLooks.saveDraft, { look });
      await expect(seller.mutation(api.shopLooks.publish, {})).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
    }
    // The About switch and the order of an all-off list are free.
    const free = withParts({ sections: { ...DEFAULT_SECTIONS, order: [...DEFAULT_SECTIONS.order].reverse(), about: false } });
    await seller.mutation(api.shopLooks.saveDraft, { look: free });
    await seller.mutation(api.shopLooks.publish, {});
    expect((await publicLook(t)).sections.about).toBe(false);
  });

  test("a downgrade shows the Free layout and keeps the saved choice; upgrading brings it back", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: withParts({ sections: sections({ about: false }) }) });
    await seller.mutation(api.shopLooks.publish, {});
    await setSubscription(t, shopId, { plan: "free", status: "expired" });
    expect((await publicLook(t)).sections).toEqual({ ...DEFAULT_SECTIONS, about: false });
    const mine = await seller.query(api.shopLooks.mine, {});
    expect(mine).toMatchObject({ sectionsEntitled: false, sectionsHiddenByPlan: true });
    expect(mine.published?.overrides.sections).toEqual(sections({ about: false }));
    await setSubscription(t, shopId, { plan: "pro", status: "active", periodEnd: Date.now() + 30 * DAY_MS });
    expect((await publicLook(t)).sections).toEqual(sections({ about: false }));
  });

  test("bad values are refused", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const look = withParts({ sections: { order: [{ id: "category", on: true }], layout: "grid2", about: true } });
    await expect(as(t, userId).mutation(api.shopLooks.saveDraft, { look })).rejects.toThrow(/LOOK_INVALID/);
  });

  test("a suspended shop is read-only", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    await expect(
      as(t, userId).mutation(api.shopLooks.saveDraft, { look: withParts({ sections: sections() }) }),
    ).rejects.toThrow(/SHOP_SUSPENDED/);
  });
});

describe("announcement bar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 22, 12));
  });
  afterEach(() => vi.useRealTimers());

  test("no dates: shown from publish; the text is cleaned", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: withParts({ announcement: { ...bar, text: `  ${bar.text}\n` } }) });
    expect((await publicLook(t)).announcement).toBeNull();
    await seller.mutation(api.shopLooks.publish, {});
    expect((await rowOf(t, shopId))?.announcementLive).toBe(true);
    expect((await publicLook(t)).announcement).toMatchObject({ text: bar.text, tone: "accent", link: null });
  });

  test("scheduled: hidden until the start, shown until the end, by scheduled jobs", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const now = Date.now();
    await as(t, userId).mutation(api.shopLooks.saveDraft, {
      look: withParts({ announcement: { ...bar, startsAt: now + DAY_MS, endsAt: now + 3 * DAY_MS } }),
    });
    await as(t, userId).mutation(api.shopLooks.publish, {});
    expect((await publicLook(t)).announcement).toBeNull();
    vi.setSystemTime(now + DAY_MS);
    await t.mutation(internal.shopLookJobs.syncSchedules, { shopId });
    expect((await publicLook(t)).announcement?.text).toBe(bar.text);
    vi.setSystemTime(now + 3 * DAY_MS);
    await t.mutation(internal.shopLookJobs.syncSchedules, { shopId });
    expect((await rowOf(t, shopId))?.announcementLive).toBe(false);
    expect((await publicLook(t)).announcement).toBeNull();
  });

  test("publish checks the plan, the dates and the link", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    const now = Date.now();
    await seller.mutation(api.shopLooks.saveDraft, { look: withParts({ announcement: { ...bar, endsAt: now + 200 * DAY_MS } }) });
    await expect(seller.mutation(api.shopLooks.publish, {})).rejects.toThrow(/ANNOUNCEMENT_SCHEDULE_INVALID/);
    await expect(
      seller.mutation(api.shopLooks.saveDraft, { look: withParts({ announcement: { ...bar, link: { kind: "url", url: "javascript:x" } } }) }),
    ).rejects.toThrow(/LOOK_INVALID/);

    await setSubscription(t, shopId, { plan: "free", status: "free" });
    await seller.mutation(api.shopLooks.saveDraft, { look: withParts({ announcement: bar }) });
    await expect(seller.mutation(api.shopLooks.publish, {})).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
  });

  test("a downgrade hides it without deleting it", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: withParts({ announcement: bar }) });
    await seller.mutation(api.shopLooks.publish, {});
    await setSubscription(t, shopId, { plan: "free", status: "expired" });
    expect((await publicLook(t)).announcement).toBeNull();
    const mine = await seller.query(api.shopLooks.mine, {});
    expect(mine).toMatchObject({ announcementEntitled: false, announcementHiddenByPlan: true });
    expect(mine.published?.overrides.announcement?.text).toBe(bar.text);
  });
});

describe("Promo bar", () => {
  const promo = {
    ...bar,
    style: "gradient" as const,
    icon: "sparkle" as const,
    title: "  Weekend sale ",
    countdown: false,
    closable: false,
    colors: { background: "#1D3557", foreground: "#ffffff" },
  };

  test("publishes the style, icon, title, switches and custom colours, resolved", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, { look: withParts({ announcement: promo }) });
    await seller.mutation(api.shopLooks.publish, {});
    const look = await publicLook(t);
    expect(look.announcement).toMatchObject({
      style: "gradient",
      icon: "sparkle",
      title: "Weekend sale",
      countdown: false,
      closable: false,
      custom: true,
      background: "#1d3557",
      foreground: "#ffffff",
    });
    expect(look.announcement?.gradientTo).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("a bar without text (sale-only) publishes", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    await as(t, userId).mutation(api.shopLooks.saveDraft, { look: withParts({ announcement: { ...bar, text: " " } }) });
    await as(t, userId).mutation(api.shopLooks.publish, {});
    expect((await rowOf(t, shopId))?.announcementLive).toBe(true);
    expect((await publicLook(t)).announcement).toMatchObject({ text: "" });
  });

  test("custom colours below 4.5:1 can be saved but not published", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const seller = as(t, userId);
    await seller.mutation(api.shopLooks.saveDraft, {
      look: withParts({ announcement: { ...bar, colors: { background: "#f4a3a3", foreground: "#ffffff" } } }),
    });
    await expect(seller.mutation(api.shopLooks.publish, {})).rejects.toThrow(/LOOK_CONTRAST/);
    await expect(
      seller.mutation(api.shopLooks.saveDraft, { look: withParts({ announcement: { ...bar, colors: { background: "pink", foreground: "#fff" } } }) }),
    ).rejects.toThrow(/LOOK_INVALID/);
  });

  test("the new options need the plan feature too", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    await as(t, userId).mutation(api.shopLooks.saveDraft, { look: withParts({ announcement: promo }) });
    await expect(as(t, userId).mutation(api.shopLooks.publish, {})).rejects.toThrow(/PLAN_FEATURE_LOCKED/);
  });
});

describe("admin reset", () => {
  async function world(t: T) {
    const roles = await builtInRoles(t);
    const admin = await insertUserWithRole(t, "boss@vano.app", roles.super_admin);
    const seller = await sellerWithShop(t, "amani@shop.cd");
    const me = as(t, seller.userId);
    await me.mutation(api.shopLooks.saveDraft, { look: { v: 1, preset: "noir", overrides: { sections: sections(), announcement: bar } } });
    await me.mutation(api.shopLooks.publish, {});
    return { admin: as(t, admin), shopId: seller.shopId };
  }

  test("“all” resets the sections, the layout and the announcement bar", async () => {
    const t = newTest();
    const { admin, shopId } = await world(t);
    expect((await admin.query(api.admin.shopLooks.get, { shopId }))?.announcement).toMatchObject({ text: bar.text, live: true });
    await admin.mutation(api.admin.shopLooks.reset, { shopId, scope: "all", reason: "Misleading offer" });
    const look = await publicLook(t);
    expect(look.sections).toEqual(DEFAULT_SECTIONS);
    expect(look.announcement).toBeNull();
    expect((await rowOf(t, shopId))?.announcementLive).toBe(false);
  });

  test("“banner” removes the announcement bar and keeps the sections", async () => {
    const t = newTest();
    const { admin, shopId } = await world(t);
    await admin.mutation(api.admin.shopLooks.reset, { shopId, scope: "banner", reason: "Misleading offer" });
    const look = await publicLook(t);
    expect(look.announcement).toBeNull();
    expect(look.sections).toEqual(sections());
    const log = await t.run((ctx) => ctx.db.query("auditLogs").withIndex("by_action", (q) => q.eq("action", "shop.lookReset")).first());
    expect(log?.details).toMatchObject({ announcement: bar.text });
  });
});

describe("product flags", () => {
  test("Featured and Few left: own products only (others are NOT_FOUND)", async () => {
    const t = newTest();
    const a = await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
    const b = await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
    const productId = await as(t, a.userId).mutation(api.products.create, await productArgs(t));
    await as(t, a.userId).mutation(api.products.setFeatured, { productId, featured: true });
    await as(t, a.userId).mutation(api.products.setFewLeft, { productId, fewLeft: true });
    expect((await as(t, a.userId).query(api.products.listMine, {}))[0]).toMatchObject({ featured: true, fewLeft: true });
    await expect(as(t, b.userId).mutation(api.products.setFeatured, { productId, featured: false })).rejects.toThrow(/NOT_FOUND/);
    await expect(as(t, b.userId).mutation(api.products.setFewLeft, { productId, fewLeft: false })).rejects.toThrow(/NOT_FOUND/);
    await expect(t.mutation(api.products.setFeatured, { productId, featured: false })).rejects.toThrow(/NOT_AUTHENTICATED/);

    // The edit form keeps them.
    await as(t, a.userId).mutation(api.products.update, { productId, ...(await productArgs(t)), name: "Renamed" });
    expect(await t.run((ctx) => ctx.db.get("products", productId))).toMatchObject({ featured: true, fewLeft: true });
  });

  test("Few left can't be set on a sold-out product, and Sold out clears it", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    const productId = await me.mutation(api.products.create, await productArgs(t));
    await me.mutation(api.products.setFewLeft, { productId, fewLeft: true });
    await me.mutation(api.products.setSoldOut, { productId, soldOut: true });
    expect((await me.query(api.products.listMine, {}))[0]).toMatchObject({ soldOut: true, fewLeft: false });
    await me.mutation(api.products.setFewLeft, { productId, fewLeft: true });
    expect((await me.query(api.products.listMine, {}))[0].fewLeft).toBe(false);
  });

  describe("back in stock", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.UTC(2026, 10, 22, 12));
    });
    afterEach(() => vi.useRealTimers());

    test("turning Sold out off marks it back in stock; the job ends it; an older job is harmless", async () => {
      const t = newTest();
      const { userId } = await sellerWithShop(t);
      const me = as(t, userId);
      const productId = await me.mutation(api.products.create, await productArgs(t, { soldOut: true }));
      await me.mutation(api.products.setSoldOut, { productId, soldOut: false });
      const first = (await t.run((ctx) => ctx.db.get("products", productId)))!.restockedAt!;
      let page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
      expect(page && !page.suspended && page.products[0].backInStock).toBe(true);

      // Sold out and back again: a new restock, the first job must not end it.
      vi.setSystemTime(Date.now() + DAY_MS);
      await me.mutation(api.products.setSoldOut, { productId, soldOut: true });
      expect((await t.run((ctx) => ctx.db.get("products", productId)))?.backInStock).toBeUndefined();
      await me.mutation(api.products.update, { productId, ...(await productArgs(t, { soldOut: false })) });
      await t.mutation(internal.productJobs.endBackInStock, { productId, restockedAt: first });
      expect((await t.run((ctx) => ctx.db.get("products", productId)))?.backInStock).toBe(true);

      const second = (await t.run((ctx) => ctx.db.get("products", productId)))!.restockedAt!;
      vi.setSystemTime(second + RESTOCK_MS);
      await t.mutation(internal.productJobs.endBackInStock, { productId, restockedAt: second });
      page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
      expect(page && !page.suspended && page.products[0].backInStock).toBe(false);
    });

    test("the job ignores a deleted product", async () => {
      const t = newTest();
      const { userId } = await sellerWithShop(t);
      const me = as(t, userId);
      const productId = await me.mutation(api.products.create, await productArgs(t, { soldOut: true }));
      await me.mutation(api.products.setSoldOut, { productId, soldOut: false });
      await me.mutation(api.products.remove, { productId });
      await expect(t.mutation(internal.productJobs.endBackInStock, { productId, restockedAt: 1 })).resolves.toBeNull();
    });
  });
});

describe("About and contact", () => {
  test("saved from Shop settings and shown publicly, only what's filled", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    await as(t, userId).mutation(api.shops.update, {
      ...settingsArgs(),
      openingHours: " Mon–Sat 9–18 ",
      deliveryAreas: "",
      socials: { instagram: "https://instagram.com/chez.amani", tiktok: "@chezamani" },
    });
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    if (!page || page.suspended) throw new Error("no page");
    expect(page.shop).toMatchObject({
      openingHours: "Mon–Sat 9–18",
      deliveryAreas: null,
      socials: { instagram: "chez.amani", tiktok: "chezamani", facebook: null },
    });
    expect(page.shop).not.toHaveProperty("ownerId");
  });

  test("too long text and bad links are refused; leaving them out clears them", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const me = as(t, userId);
    await expect(me.mutation(api.shops.update, { ...settingsArgs(), openingHours: "x".repeat(200) })).rejects.toThrow(/INFO_TOO_LONG/);
    await expect(me.mutation(api.shops.update, { ...settingsArgs(), socials: { facebook: "https://evil.com/x" } })).rejects.toThrow(
      /SOCIAL_INVALID/,
    );
    await me.mutation(api.shops.update, { ...settingsArgs(), openingHours: "9–18" });
    await me.mutation(api.shops.update, settingsArgs());
    expect((await t.run((ctx) => ctx.db.get("shops", shopId)))?.openingHours).toBeUndefined();
  });
});
