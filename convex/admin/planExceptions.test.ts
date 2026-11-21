import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DAY_MS } from "../lib/plans";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  sellerWithShop,
  setSubscription,
  shopArgs,
  type T,
} from "../lib/test.utils";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-19T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const audit = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());

async function world(t: T) {
  const roles = await builtInRoles(t);
  const boss = await insertUserWithRole(t, "boss@vano.app", roles.super_admin);
  const billing = await insertUserWithRole(t, "billing@vano.app", await insertRole(t, "Billing", ["billing.manage", "shops.view"]));
  const shop = await sellerWithShop(t, "amani@shop.cd", { slug: "chez-amani", name: "Chez Amani" });
  await setSubscription(t, shop.shopId, { plan: "free", status: "free" });
  return { boss: as(t, boss), bossId: boss, billing: as(t, billing), shop };
}

const grantArgs = (shopId: Id<"shops">, extra: Partial<{ feature: string; value: boolean | number | null; endsAt: number; reason: string }> = {}) => ({
  shopId,
  feature: "allLooks",
  value: true,
  endsAt: Date.now() + 7 * DAY_MS,
  reason: "Partner shop",
  ...extra,
});

describe("admin.planExceptions", () => {
  test("grant: listed on the shop, logged, needs plans.manage", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(w.billing.mutation(api.admin.planExceptions.grant, grantArgs(w.shop.shopId))).rejects.toThrow(/FORBIDDEN/);
    await expect(w.billing.query(api.admin.planExceptions.listForShop, { shopId: w.shop.shopId })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.shop.userId).mutation(api.admin.planExceptions.grant, grantArgs(w.shop.shopId))).rejects.toThrow(/FORBIDDEN/);

    await w.boss.mutation(api.admin.planExceptions.grant, grantArgs(w.shop.shopId));
    const list = await w.boss.query(api.admin.planExceptions.listForShop, { shopId: w.shop.shopId });
    expect(list).toMatchObject([{ feature: "allLooks", value: true, active: true, reason: "Partner shop", createdByEmail: "boss@vano.app" }]);
    const log = (await audit(t)).find((l) => l.action === "planException.granted");
    expect(log).toMatchObject({ targetType: "shop", targetId: w.shop.shopId, targetLabel: "Chez Amani" });
    expect(log?.details).toMatchObject({ feature: "allLooks", value: true, plan: "free", endsAt: "2026-11-26", reason: "Partner shop" });
  });

  test("refuses: unknown or pricing-only features, nothing more than the plan, bad dates or reasons, own shop", async () => {
    const t = newTest();
    const w = await world(t);
    const grant = (extra: Parameters<typeof grantArgs>[1]) => w.boss.mutation(api.admin.planExceptions.grant, grantArgs(w.shop.shopId, extra));
    await expect(grant({ feature: "madeUp" })).rejects.toThrow(/EXCEPTION_INVALID/);
    await expect(grant({ feature: "customDomain" })).rejects.toThrow(/EXCEPTION_INVALID/);
    await expect(grant({ value: false })).rejects.toThrow(/EXCEPTION_INVALID/);
    await expect(grant({ feature: "products", value: 5 })).rejects.toThrow(/EXCEPTION_INVALID/);
    await expect(grant({ feature: "products", value: -3 })).rejects.toThrow(/EXCEPTION_INVALID/);
    await expect(grant({ endsAt: Date.now() - 1 })).rejects.toThrow(/DAYS_INVALID/);
    await expect(grant({ endsAt: Date.now() + 400 * DAY_MS })).rejects.toThrow(/DAYS_INVALID/);
    await expect(grant({ reason: "x" })).rejects.toThrow(/REASON_INVALID/);
    await expect(grant({ feature: "products", value: 40 })).resolves.toBeTruthy();

    const own = await w.boss.mutation(api.shops.create, shopArgs({ slug: "boss-shop" }));
    await expect(w.boss.mutation(api.admin.planExceptions.grant, grantArgs(own))).rejects.toThrow(/CANNOT_MODIFY_SELF/);
  });

  test("revoke and expiry end it, both logged; the job is idempotent", async () => {
    const t = newTest();
    const w = await world(t);
    const a = await w.boss.mutation(api.admin.planExceptions.grant, grantArgs(w.shop.shopId));
    const b = await w.boss.mutation(api.admin.planExceptions.grant, grantArgs(w.shop.shopId, { feature: "shopStats", endsAt: Date.now() + DAY_MS }));
    await w.boss.mutation(api.admin.planExceptions.revoke, { exceptionId: a });
    await expect(w.boss.mutation(api.admin.planExceptions.revoke, { exceptionId: a })).rejects.toThrow(/NOT_FOUND/);

    vi.setSystemTime(Date.now() + 2 * DAY_MS);
    await t.mutation(internal.planExceptionJobs.expire, { exceptionId: b });
    await t.mutation(internal.planExceptionJobs.expire, { exceptionId: b });
    expect(await t.mutation(internal.planExceptionJobs.sweep, {})).toBe(0);

    const list = await w.boss.query(api.admin.planExceptions.listForShop, { shopId: w.shop.shopId });
    expect(list.map((e) => [e.feature, e.active, e.endedReason]).sort()).toEqual([
      ["allLooks", false, "revoked"],
      ["shopStats", false, "expired"],
    ]);
    const actions = (await audit(t)).map((l) => l.action);
    expect(actions.filter((x) => x === "planException.revoked")).toHaveLength(1);
    expect(actions.filter((x) => x === "planException.expired")).toHaveLength(1);
  });

  test("the hourly sweep ends exceptions the scheduled job missed", async () => {
    const t = newTest();
    const w = await world(t);
    await w.boss.mutation(api.admin.planExceptions.grant, grantArgs(w.shop.shopId, { endsAt: Date.now() + DAY_MS }));
    vi.setSystemTime(Date.now() + 2 * DAY_MS);
    expect(await t.mutation(internal.planExceptionJobs.sweep, {})).toBe(1);
  });
});
