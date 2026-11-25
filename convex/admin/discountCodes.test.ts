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
  setSubscription,
  shopArgs,
  type T,
} from "../lib/test.utils";

const DAY = 86_400_000;
const REASON = "Misleading discount";

function codeArgs(code = "FAKE90") {
  return {
    code,
    discount: { kind: "percent" as const, value: 30 },
    target: { kind: "shop" as const, excludedIds: [] as Id<"products">[] },
    endsAt: Date.now() + DAY,
  };
}

async function world(t: T) {
  const ids = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const viewer = await insertUserWithRole(t, "viewer@vano.app", await insertRole(t, "Viewer", ["shops.view"]));
  const salesMod = await insertUserWithRole(
    t,
    "sales@vano.app",
    await insertRole(t, "Sales", ["shops.view", "shops.manageSales"]),
  );
  const moderator = await insertUserWithRole(
    t,
    "mod@vano.app",
    await insertRole(t, "Moderator", ["shops.view", "shops.manageDiscountCodes"]),
  );
  const seller = await sellerWithShop(t, "amani@shop.cd");
  await setSubscription(t, seller.shopId, { plan: "business", status: "active", periodEnd: Date.now() + 30 * DAY });
  const me = as(t, seller.userId);
  await me.mutation(api.products.create, await productArgs(t, { price: 2500 }));
  const codeId = await me.mutation(api.discountCodes.create, { ...codeArgs(), maxUses: 10 });
  return { admin, viewer, salesMod, moderator, seller, codeId };
}

describe("admin.discountCodes.listForShop", () => {
  test("shows the shop's codes with their uses", async () => {
    const t = newTest();
    const w = await world(t);
    const view = await as(t, w.viewer).query(api.admin.discountCodes.listForShop, { shopId: w.seller.shopId });
    expect(view?.codes).toHaveLength(1);
    expect(view?.codes[0]).toMatchObject({ code: "FAKE90", live: true, products: 1, uses: 0, maxUses: 10, adminPause: null });
    expect(await as(t, w.viewer).query(api.admin.discountCodes.listForShop, { shopId: "nope" })).toBeNull();
    await expect(
      as(t, w.seller.userId).query(api.admin.discountCodes.listForShop, { shopId: w.seller.shopId }),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("admin.discountCodes.pause / remove", () => {
  test("pause: stops the code, is logged and tells the seller, who can resume", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.moderator).mutation(api.admin.discountCodes.pause, { codeId: w.codeId, reason: REASON });
    expect(await t.run((ctx) => ctx.db.get("discountCodes", w.codeId))).toMatchObject({
      live: false,
      adminPause: { reason: REASON },
    });

    const [log] = await t.run((ctx) => ctx.db.query("auditLogs").order("desc").take(1));
    expect(log).toMatchObject({
      action: "discountCode.adminPaused",
      targetType: "shop",
      targetId: w.seller.shopId,
      details: { code: "FAKE90", reason: REASON },
    });

    const inbox = await as(t, w.seller.userId).query(api.notifications.inbox.latest, {});
    expect(inbox[0].data).toMatchObject({ type: "discountCode.adminPaused", code: "FAKE90", reason: REASON });

    await as(t, w.seller.userId).mutation(api.discountCodes.resume, { codeId: w.codeId });
    expect(await t.run((ctx) => ctx.db.get("discountCodes", w.codeId))).toMatchObject({ live: true, paused: false });
  });

  test("remove: deletes the code, logs and notifies", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.discountCodes.remove, { codeId: w.codeId, reason: REASON });
    expect(await t.run((ctx) => ctx.db.get("discountCodes", w.codeId))).toBeNull();
    const [log] = await t.run((ctx) => ctx.db.query("auditLogs").order("desc").take(1));
    expect(log).toMatchObject({ action: "discountCode.adminDeleted", targetId: w.seller.shopId });
    const inbox = await as(t, w.seller.userId).query(api.notifications.inbox.latest, {});
    expect(inbox[0].data).toMatchObject({ type: "discountCode.adminDeleted", code: "FAKE90" });
  });

  test("needs shops.manageDiscountCodes (not the sales one) and a reason", async () => {
    const t = newTest();
    const w = await world(t);
    for (const who of [w.viewer, w.salesMod, w.seller.userId]) {
      await expect(
        as(t, who).mutation(api.admin.discountCodes.pause, { codeId: w.codeId, reason: REASON }),
      ).rejects.toThrow(/FORBIDDEN/);
      await expect(
        as(t, who).mutation(api.admin.discountCodes.remove, { codeId: w.codeId, reason: REASON }),
      ).rejects.toThrow(/FORBIDDEN/);
    }
    await expect(
      as(t, w.moderator).mutation(api.admin.discountCodes.pause, { codeId: w.codeId, reason: "no" }),
    ).rejects.toThrow(/REASON_INVALID/);
  });

  test("never on the admin's own shop", async () => {
    const t = newTest();
    const w = await world(t);
    const boss = as(t, w.admin);
    const shopId = await boss.mutation(api.shops.create, shopArgs({ slug: "boss-shop" }));
    await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: Date.now() + DAY });
    await boss.mutation(api.products.create, await productArgs(t, { price: 2500 }));
    const own = await boss.mutation(api.discountCodes.create, codeArgs("MINE"));
    await expect(boss.mutation(api.admin.discountCodes.pause, { codeId: own, reason: REASON })).rejects.toThrow(
      /CANNOT_MODIFY_SELF/,
    );
  });
});
