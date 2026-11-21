import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  productArgs,
  sellerWithShop,
  shopArgs,
  type T,
} from "../lib/test.utils";

const DAY = 86_400_000;

async function world(t: T) {
  const ids = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const viewer = await insertUserWithRole(t, "viewer@vano.app", await insertRole(t, "Viewer", ["shops.view"]));
  const moderator = await insertUserWithRole(
    t,
    "mod@vano.app",
    await insertRole(t, "Moderator", ["shops.view", "shops.manageSales"]),
  );
  const seller = await sellerWithShop(t, "amani@shop.cd");
  const me = as(t, seller.userId);
  await me.mutation(api.products.create, await productArgs(t, { price: 2500 }));
  const saleId = await me.mutation(api.sales.create, {
    name: "Fake -90%",
    discount: { kind: "percent", value: 30 },
    target: { kind: "shop", excludedIds: [] },
    endsAt: Date.now() + DAY,
    display: { countdown: true, badge: true, label: false },
    steepConfirmed: false,
  });
  return { admin, viewer, moderator, seller, saleId };
}

const REASON = "Misleading discount";

describe("admin.sales.listForShop", () => {
  test("shows the shop's sales with their numbers", async () => {
    const t = newTest();
    const w = await world(t);
    const view = await as(t, w.viewer).query(api.admin.sales.listForShop, { shopId: w.seller.shopId });
    expect(view?.sales).toHaveLength(1);
    expect(view?.sales[0]).toMatchObject({ name: "Fake -90%", live: true, products: 1, views: 0, adminPause: null });
    expect(await as(t, w.viewer).query(api.admin.sales.listForShop, { shopId: "nope" })).toBeNull();
    await expect(as(t, w.seller.userId).query(api.admin.sales.listForShop, { shopId: w.seller.shopId })).rejects.toThrow(
      /FORBIDDEN/,
    );
  });
});

describe("admin.sales.pause / remove", () => {
  test("pause: stops the sale, is logged and tells the seller, who can resume", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.moderator).mutation(api.admin.sales.pause, { saleId: w.saleId, reason: REASON });
    const sale = await t.run((ctx) => ctx.db.get("sales", w.saleId));
    expect(sale).toMatchObject({ live: false, adminPause: { reason: REASON } });

    const [log] = await t.run((ctx) => ctx.db.query("auditLogs").order("desc").take(1));
    expect(log).toMatchObject({ action: "sale.adminPaused", targetType: "shop", targetId: w.seller.shopId, details: { sale: "Fake -90%", reason: REASON } });

    const inbox = await as(t, w.seller.userId).query(api.notifications.inbox.latest, {});
    expect(inbox[0].data).toMatchObject({ type: "sale.adminPaused", reason: REASON });

    await as(t, w.seller.userId).mutation(api.sales.resume, { saleId: w.saleId });
    expect(await t.run((ctx) => ctx.db.get("sales", w.saleId))).toMatchObject({ live: true, paused: false });
  });

  test("remove: deletes the sale, logs and notifies", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.sales.remove, { saleId: w.saleId, reason: REASON });
    expect(await t.run((ctx) => ctx.db.get("sales", w.saleId))).toBeNull();
    const [log] = await t.run((ctx) => ctx.db.query("auditLogs").order("desc").take(1));
    expect(log).toMatchObject({ action: "sale.adminDeleted", targetId: w.seller.shopId });
    const inbox = await as(t, w.seller.userId).query(api.notifications.inbox.latest, {});
    expect(inbox[0].data).toMatchObject({ type: "sale.adminDeleted", name: "Fake -90%" });
  });

  test("needs shops.manageSales and a reason", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(as(t, w.viewer).mutation(api.admin.sales.pause, { saleId: w.saleId, reason: REASON })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.seller.userId).mutation(api.admin.sales.remove, { saleId: w.saleId, reason: REASON })).rejects.toThrow(
      /FORBIDDEN/,
    );
    await expect(as(t, w.moderator).mutation(api.admin.sales.pause, { saleId: w.saleId, reason: "no" })).rejects.toThrow(
      /REASON_INVALID/,
    );
  });

  test("never on the admin's own shop", async () => {
    const t = newTest();
    const w = await world(t);
    const boss = as(t, w.admin);
    await boss.mutation(api.shops.create, shopArgs({ slug: "boss-shop" }));
    await boss.mutation(api.products.create, await productArgs(t, { price: 2500 }));
    const own = await boss.mutation(api.sales.create, {
      name: "Mine",
      discount: { kind: "percent", value: 10 },
      target: { kind: "shop", excludedIds: [] },
      endsAt: Date.now() + DAY,
      display: { countdown: false, badge: true, label: false },
      steepConfirmed: false,
    });
    await expect(boss.mutation(api.admin.sales.pause, { saleId: own, reason: REASON })).rejects.toThrow(/CANNOT_MODIFY_SELF/);
  });
});
