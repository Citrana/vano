import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  productArgs,
  sellerWithShop,
  setSubscription,
  type T,
} from "../lib/test.utils";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 19, 12);
const REASON = "Customer dispute reported to support";

async function world(t: T) {
  const ids = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const viewer = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Viewer", ["shops.view"]));
  const privacy = await insertUserWithRole(t, "p@vano.app", await insertRole(t, "Privacy", ["shops.view", "shops.viewCustomers"]));
  const { userId, shopId } = await sellerWithShop(t, "amani@shop.cd");
  await setSubscription(t, shopId, { plan: "business", status: "active", periodEnd: NOW + 60 * DAY });
  const me = as(t, userId);
  const bag = await me.mutation(api.products.create, await productArgs(t, { name: "Sac", price: 10_000, sizes: [], colors: [] }));
  const sale = await me.mutation(api.salesRecords.record, {
    productId: bag,
    quantity: 2,
    finalUnitPrice: 9000,
    source: "whatsapp",
    soldAt: NOW - DAY,
    markSoldOut: true,
    customerName: "Neema",
    customerPhone: "+243812345678",
  });
  return { admin, viewer, privacy, userId, shopId, me, bag, sale };
}

const auditRows = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("admin: recorded sales", () => {
  test("the summary shows totals and never customer data", async () => {
    const t = newTest();
    const w = await world(t);
    const summary = await as(t, w.viewer).query(api.admin.salesRecords.summaryForShop, { shopId: w.shopId });
    expect(summary).toEqual({
      currency: "USD",
      count: 1,
      items: 2,
      revenue: 18_000,
      discounts: 2000,
      reversed: 0,
      truncated: false,
      lastSoldAt: NOW - DAY,
    });
    expect(JSON.stringify(summary)).not.toContain("Neema");
    expect(await as(t, w.viewer).query(api.admin.salesRecords.summaryForShop, { shopId: "nope" })).toBeNull();
  });

  test("customer details need shops.viewCustomers and a reason, and are logged", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(
      as(t, w.viewer).mutation(api.admin.salesRecords.revealCustomers, { shopId: w.shopId, reason: REASON }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      as(t, w.privacy).mutation(api.admin.salesRecords.revealCustomers, { shopId: w.shopId, reason: "x" }),
    ).rejects.toThrow(/REASON_INVALID/);
    expect(await auditRows(t)).toEqual([]);

    const rows = await as(t, w.privacy).mutation(api.admin.salesRecords.revealCustomers, { shopId: w.shopId, reason: REASON });
    expect(rows).toEqual([
      expect.objectContaining({ productName: "Sac", customerName: "Neema", customerPhone: "+243812345678", source: "whatsapp" }),
    ]);
    expect(await auditRows(t)).toEqual([
      expect.objectContaining({
        action: "salesRecord.customersViewed",
        actorEmail: "p@vano.app",
        targetType: "shop",
        targetId: w.shopId,
        details: { reason: REASON, records: 1 },
      }),
    ]);
  });

  test("never on the admin's own shop", async () => {
    const t = newTest();
    const w = await world(t);
    const ids = await builtInRoles(t);
    await t.run((ctx) => ctx.db.patch("users", w.userId, { roleId: ids.super_admin }));
    await expect(
      as(t, w.userId).mutation(api.admin.salesRecords.revealCustomers, { shopId: w.shopId, reason: REASON }),
    ).rejects.toThrow(/CANNOT_MODIFY_SELF/);
  });

  test("deleting the shop purges its sales, history and the photos they kept", async () => {
    const t = newTest();
    const w = await world(t);
    await w.me.mutation(api.products.remove, { productId: w.bag });
    // The product is gone but its sale keeps the photo.
    expect(await t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length)).toBe(1);
    await as(t, w.admin).mutation(api.admin.shops.remove, { shopId: w.shopId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = await t.run(async (ctx) => ({
      records: (await ctx.db.query("salesRecords").collect()).length,
      events: (await ctx.db.query("productEvents").collect()).length,
      uploads: (await ctx.db.query("uploads").collect()).length,
      files: (await ctx.db.system.query("_storage").collect()).length,
    }));
    expect(left).toEqual({ records: 0, events: 0, uploads: 0, files: 0 });
    expect(w.sale).toBeTruthy();
  });
});
