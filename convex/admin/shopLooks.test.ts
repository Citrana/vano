import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { FREE_LOOK } from "../lib/looks/presets";
import type { StoredLook } from "../lib/looks/validators";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  sellerWithShop,
  setSubscription,
  storeFile,
  type T,
} from "../lib/test.utils";

const fileExists = (t: T, id: Id<"_storage">) => t.run(async (ctx) => (await ctx.db.system.get("_storage", id)) !== null);

const photoLook = (imageId: Id<"_storage">, text: string): StoredLook => ({
  v: 1,
  preset: "lavender",
  overrides: {
    colors: { accent: "#0e6e85", background: "#f1f8fa" },
    banner: { kind: "photo", imageId, focusX: 50, focusY: 50, zoom: 1, height: "lg", text: { value: text, align: "center" } },
  },
});

async function world(t: T) {
  const ids = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const viewerRole = await insertRole(t, "Viewer", ["shops.view"]);
  const viewer = await insertUserWithRole(t, "viewer@vano.app", viewerRole);
  const seller = await sellerWithShop(t, "amani@shop.cd");
  const photo = await storeFile(t);
  const draftPhoto = await storeFile(t);
  const me = as(t, seller.userId);
  await me.mutation(api.shopLooks.saveDraft, { look: photoLook(photo, "Rude words") });
  await me.mutation(api.shopLooks.publish, {});
  await me.mutation(api.shopLooks.saveDraft, { look: photoLook(draftPhoto, "Draft words") });
  return { admin, viewer, seller, photo, draftPhoto };
}

describe("admin.shopLooks.get", () => {
  test("shows the visible and published look with banner texts", async () => {
    const t = newTest();
    const w = await world(t);
    const view = await as(t, w.viewer).query(api.admin.shopLooks.get, { shopId: w.seller.shopId });
    expect(view).toMatchObject({
      visible: { preset: "lavender", banner: { kind: "photo" } },
      published: { preset: "lavender" },
      publishedBannerText: "Rude words",
      draftBannerText: "Draft words",
      draftHasPhoto: true,
    });
    expect(await as(t, w.viewer).query(api.admin.shopLooks.get, { shopId: "nope" })).toBeNull();
  });

  test("the visible look is the free one after a downgrade", async () => {
    const t = newTest();
    const w = await world(t);
    await setSubscription(t, w.seller.shopId, { plan: "free", status: "free" });
    const view = await as(t, w.admin).query(api.admin.shopLooks.get, { shopId: w.seller.shopId });
    expect(view?.visible.preset).toBe("classic");
    expect(view?.hiddenByPlan).toBe(true);
    expect(view?.published?.preset).toBe("lavender");
  });

  test("sellers can't read it", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(as(t, w.seller.userId).query(api.admin.shopLooks.get, { shopId: w.seller.shopId })).rejects.toThrow(
      /FORBIDDEN/,
    );
  });
});

describe("admin.shopLooks.reset", () => {
  test("banner: removes photos and text, keeps colours; logged and the seller is told", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.shopLooks.reset, {
      shopId: w.seller.shopId,
      scope: "banner",
      reason: "Inappropriate banner text",
    });
    const mine = await as(t, w.seller.userId).query(api.shopLooks.mine, {});
    expect(mine.published?.overrides).toEqual({
      colors: { accent: "#0e6e85", background: "#f1f8fa" },
      banner: { kind: "none" },
    });
    expect(mine.editing.overrides.banner).toEqual({ kind: "none" });
    expect(mine.resetByAdminAt).toEqual(expect.any(Number));
    expect(await fileExists(t, w.photo)).toBe(false);
    expect(await fileExists(t, w.draftPhoto)).toBe(false);

    const [audit] = await t.run((ctx) => ctx.db.query("auditLogs").order("desc").take(1));
    expect(audit).toMatchObject({
      action: "shop.lookReset",
      targetId: w.seller.shopId,
      details: { scope: "banner", reason: "Inappropriate banner text", bannerText: "Rude words", bannerPhoto: true },
    });
    const [notice] = await as(t, w.seller.userId).query(api.notifications.inbox.latest, {});
    expect(notice.data).toEqual({ type: "look.reset", scope: "banner", reason: "Inappropriate banner text" });
    const row = await t.run((ctx) => ctx.db.get("notifications", notice._id));
    expect(row?.category).toBe("shop");
  });

  test("banner text on a gradient is removed, the gradient stays", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.seller.userId);
    await me.mutation(api.shopLooks.saveDraft, {
      look: {
        v: 1,
        preset: "blush",
        overrides: { banner: { kind: "gradient", gradientId: "roseDusk", height: "md", text: { value: "Bad", align: "start" } } },
      },
    });
    await me.mutation(api.shopLooks.publish, {});
    await as(t, w.admin).mutation(api.admin.shopLooks.reset, { shopId: w.seller.shopId, scope: "banner", reason: "Bad text" });
    expect((await me.query(api.shopLooks.mine, {})).published?.overrides.banner).toEqual({
      kind: "gradient",
      gradientId: "roseDusk",
      height: "md",
    });
  });

  test("all: back to the free look, draft cleared", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.shopLooks.reset, { shopId: w.seller.shopId, scope: "all", reason: "Impersonation" });
    const mine = await as(t, w.seller.userId).query(api.shopLooks.mine, {});
    expect(mine.published).toEqual(FREE_LOOK);
    expect(mine.editing).toEqual(FREE_LOOK);
    expect(mine.hasUnpublishedChanges).toBe(false);
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    expect(page && !page.suspended && page.shop.look.preset).toBe("classic");
  });

  test("needs shops.resetLook, a reason, and never on your own shop", async () => {
    const t = newTest();
    const w = await world(t);
    const args = { shopId: w.seller.shopId, scope: "all" as const, reason: "Inappropriate" };
    await expect(as(t, w.viewer).mutation(api.admin.shopLooks.reset, args)).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.seller.userId).mutation(api.admin.shopLooks.reset, args)).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.admin).mutation(api.admin.shopLooks.reset, { ...args, reason: " no " })).rejects.toThrow(
      /REASON_INVALID/,
    );

    // A super admin who also sells can't reset their own shop.
    const adminShop = await as(t, w.admin).mutation(api.shops.create, {
      name: "Boss Shop",
      slug: "boss-shop",
      currency: "USD",
      language: "en",
      categories: ["bags"],
      whatsappNumber: "+243 812 345 679",
      city: "Goma",
      country: "CD",
    });
    await expect(
      as(t, w.admin).mutation(api.admin.shopLooks.reset, { ...args, shopId: adminShop }),
    ).rejects.toThrow(/CANNOT_MODIFY_SELF/);
  });

  test("a shop that never designed a look is a no-op", async () => {
    const t = newTest();
    const w = await world(t);
    const other = await sellerWithShop(t, "b@shop.cd", { slug: "other-shop" });
    await as(t, w.admin).mutation(api.admin.shopLooks.reset, { shopId: other.shopId, scope: "all", reason: "Just checking" });
    expect(await as(t, other.userId).query(api.notifications.inbox.latest, {})).toEqual([]);
  });
});

describe("event & promo banners (admin)", () => {
  const promoLook: StoredLook = {
    v: 1,
    preset: "blush",
    overrides: {
      banner: { kind: "gradient", gradientId: "roseDusk", height: "sm", text: { value: "Hello", align: "start" } },
      promo: {
        design: { template: "sale", palette: "hotPink", font: "bold", headline: "Rude promo", subline: "Bad line", stickers: ["heart"] },
        height: "md",
      },
    },
  };

  test("get shows the live event banner and its texts", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.seller.userId);
    await me.mutation(api.shopLooks.saveDraft, { look: promoLook });
    await me.mutation(api.shopLooks.publish, {});
    const view = await as(t, w.viewer).query(api.admin.shopLooks.get, { shopId: w.seller.shopId });
    expect(view?.visible.banner.kind).toBe("event");
    expect(view?.hiddenByPlan).toBe(false);
    expect(view?.promo).toMatchObject({ template: "sale", headline: "Rude promo", subline: "Bad line", live: true });
    expect(view?.draftPromo).toBeNull();
  });

  test("banner reset removes the event banner everywhere; logged with its headline", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.seller.userId);
    await me.mutation(api.shopLooks.saveDraft, { look: promoLook });
    await me.mutation(api.shopLooks.publish, {});
    await me.mutation(api.shopLooks.saveDraft, { look: { ...promoLook, preset: "lavender" } });
    await as(t, w.admin).mutation(api.admin.shopLooks.reset, { shopId: w.seller.shopId, scope: "banner", reason: "Rude promo text" });

    const mine = await me.query(api.shopLooks.mine, {});
    expect(mine.published?.overrides.promo).toBeUndefined();
    expect(mine.editing.overrides.promo).toBeUndefined();
    expect(mine.published?.overrides.banner).toEqual({ kind: "gradient", gradientId: "roseDusk", height: "sm" });
    expect(mine.promoLive).toBe(false);
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    expect(page && !page.suspended && page.shop.look.banner.kind).toBe("gradient");
    const [audit] = await t.run((ctx) => ctx.db.query("auditLogs").order("desc").take(1));
    expect(audit.details).toMatchObject({ scope: "banner", promoHeadline: "Rude promo" });
  });
});

describe("button designs (admin)", () => {
  test("the whole-look reset also resets the button design and label", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.seller.userId);
    await me.mutation(api.shopLooks.saveDraft, {
      look: { v: 1, preset: "blush", overrides: { buttons: { shape: "pill", fill: "solid", weight: "bold", design: "sticker", label: "orderNow" } } },
    });
    await me.mutation(api.shopLooks.publish, {});
    await as(t, w.admin).mutation(api.admin.shopLooks.reset, { shopId: w.seller.shopId, scope: "all", reason: "Reset requested" });
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    expect(page && !page.suspended && page.shop.look.buttons).toMatchObject({ design: "classic", label: "order" });
    expect((await me.query(api.shopLooks.mine, {})).published?.overrides.buttons).toBeUndefined();
  });
});

describe("profile photo (admin)", () => {
  const profileLook: StoredLook = {
    v: 1,
    preset: "blush",
    overrides: {
      colors: { accent: "#0e6e85", background: "#f1f8fa" },
      banner: { kind: "gradient", gradientId: "roseDusk", height: "sm", text: { value: "Hello", align: "start" } },
      profile: {
        shape: "arch",
        borderWidth: "thick",
        borderStyle: "glow",
        borderColor: { kind: "custom", hex: "#5b1f4a" },
        size: "lg",
        position: "center",
        overlap: "below",
        corner: "heart",
        decoration: { id: "bossLady" },
      },
    },
  };

  test("get shows the decoration", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.seller.userId);
    await me.mutation(api.shopLooks.saveDraft, { look: profileLook });
    await me.mutation(api.shopLooks.publish, {});
    const view = await as(t, w.viewer).query(api.admin.shopLooks.get, { shopId: w.seller.shopId });
    expect(view).toMatchObject({ decoration: "bossLady", decorationLive: true, draftDecoration: null, hasProfile: true });
    expect(view?.visible.profile).toMatchObject({ shape: "arch", decoration: "bossLady" });
  });

  test("profile reset: photo options and decoration back to default, banner and colours stay; logged and told", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.seller.userId);
    await me.mutation(api.shopLooks.saveDraft, { look: profileLook });
    await me.mutation(api.shopLooks.publish, {});
    await me.mutation(api.shopLooks.saveDraft, { look: { ...profileLook, preset: "lavender" } });
    await as(t, w.admin).mutation(api.admin.shopLooks.reset, { shopId: w.seller.shopId, scope: "profile", reason: "Rude badge" });

    const mine = await me.query(api.shopLooks.mine, {});
    expect(mine.published?.overrides.profile).toBeUndefined();
    expect(mine.published?.overrides.banner).toEqual(profileLook.overrides.banner);
    expect(mine.published?.overrides.colors).toEqual(profileLook.overrides.colors);
    expect(mine.editing.preset).toBe("lavender"); // the draft is kept, without its profile
    expect(mine.editing.overrides.profile).toBeUndefined();
    expect(mine.decorationLive).toBe(false);
    const page = await t.query(api.public.shopBySlug, { slug: "chez-amani" });
    expect(page && !page.suspended && page.shop.look.profile).toMatchObject({ shape: "circle", decoration: null });

    const [audit] = await t.run((ctx) => ctx.db.query("auditLogs").order("desc").take(1));
    expect(audit.details).toMatchObject({ scope: "profile", decoration: "bossLady", bannerText: "", bannerPhoto: false });
    const [notice] = await me.query(api.notifications.inbox.latest, {});
    expect(notice.data).toEqual({ type: "look.reset", scope: "profile", reason: "Rude badge" });
  });

  test("the whole-look reset also resets the profile; the banner reset keeps it", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.seller.userId);
    await me.mutation(api.shopLooks.saveDraft, { look: profileLook });
    await me.mutation(api.shopLooks.publish, {});
    await as(t, w.admin).mutation(api.admin.shopLooks.reset, { shopId: w.seller.shopId, scope: "banner", reason: "Banner text" });
    expect((await me.query(api.shopLooks.mine, {})).published?.overrides.profile).toEqual(profileLook.overrides.profile);
    expect((await me.query(api.shopLooks.mine, {})).decorationLive).toBe(true);
    await as(t, w.admin).mutation(api.admin.shopLooks.reset, { shopId: w.seller.shopId, scope: "all", reason: "Everything" });
    expect((await me.query(api.shopLooks.mine, {})).published).toEqual(FREE_LOOK);
  });

  test("never on your own shop, and needs shops.resetLook", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(
      as(t, w.viewer).mutation(api.admin.shopLooks.reset, { shopId: w.seller.shopId, scope: "profile", reason: "No access" }),
    ).rejects.toThrow(/FORBIDDEN/);
    const adminShop = await as(t, w.admin).mutation(api.shops.create, {
      name: "Boss Shop",
      slug: "boss-shop",
      currency: "USD",
      language: "en",
      categories: ["bags"],
      whatsappNumber: "+243 812 345 679",
      city: "Goma",
      country: "CD",
    });
    await expect(
      as(t, w.admin).mutation(api.admin.shopLooks.reset, { shopId: adminShop, scope: "profile", reason: "My own shop" }),
    ).rejects.toThrow(/CANNOT_MODIFY_SELF/);
  });
});
