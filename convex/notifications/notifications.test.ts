import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { notify } from "../lib/notify";
import { DAY_MS } from "../lib/plans";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  sellerWithShop,
  setSubscription,
  type T,
} from "../lib/test.utils";
import { mockEvent } from "../payments/mock";
import { COUNT_CAP, NOTIFICATION_RETENTION_DAYS } from "./config";
import { notificationHref, type NotificationData } from "./types";

const REASON = "We moved to a new location and renamed the brand.";
const page = { numItems: 50, cursor: null };
const NOW = new Date("2026-11-19T12:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function world(t: T) {
  const roles = await builtInRoles(t);
  const boss = await insertUserWithRole(t, "boss@vano.app", roles.super_admin);
  const support = await insertUserWithRole(t, "support@vano.app", await insertRole(t, "Support", ["changeRequests.view"]));
  const finance = await insertUserWithRole(t, "finance@vano.app", await insertRole(t, "Finance", ["billing.view"]));
  const gone = await insertUserWithRole(t, "gone@vano.app", roles.super_admin, "suspended");
  const amani = await sellerWithShop(t, "amani@shop.cd", { slug: "chez-amani", name: "Chez Amani" });
  return { roles, boss, support, finance, gone, amani };
}

const rowsOf = (t: T, userId: Id<"users">) =>
  t.run((ctx) => ctx.db.query("notifications").withIndex("by_userId", (q) => q.eq("userId", userId)).collect());
const typesOf = async (t: T, userId: Id<"users">) => (await rowsOf(t, userId)).map((r) => r.data.type);

function send(t: T, data: NotificationData, to: Parameters<typeof notify>[1]["to"], dedupeKey: string, exclude?: Id<"users">[]) {
  return t.run((ctx) => notify(ctx, { data, to, dedupeKey, exclude }));
}

const summary = (count: number): NotificationData => ({ type: "admin.endingSoon", count, capped: false, day: "2026-11-19" });
/** A seller-facing notification (no permission attached). */
const activated: NotificationData = { type: "plan.activated", plan: "pro", periodEnd: NOW };

describe("notify", () => {
  test("a permission reaches its holders (super admins included), never suspended users or the excluded", async () => {
    const t = newTest();
    const w = await world(t);
    const created = await send(t, summary(2), { permission: "billing.view" }, "k1", [w.finance]);
    expect(created).toBe(1);
    expect(await typesOf(t, w.boss)).toEqual(["admin.endingSoon"]);
    for (const id of [w.finance, w.support, w.gone, w.amani.userId]) expect(await rowsOf(t, id)).toEqual([]);
    expect((await rowsOf(t, w.boss))[0]).toMatchObject({ category: "billing", requiredPermission: "billing.view" });
  });

  test("the same dedupe key never reaches a user twice", async () => {
    const t = newTest();
    const w = await world(t);
    expect(await send(t, summary(1), { permission: "changeRequests.view" }, "same")).toBe(2);
    expect(await send(t, summary(1), { permission: "changeRequests.view" }, "same")).toBe(0);
    expect(await send(t, summary(1), { userId: w.amani.userId }, "same")).toBe(1);
    expect(await rowsOf(t, w.boss)).toHaveLength(1);
  });

  test("an admin type sent to one user still needs its permission to be seen", async () => {
    const t = newTest();
    const w = await world(t);
    await send(t, summary(1), { userId: w.amani.userId }, "x");
    expect((await rowsOf(t, w.amani.userId))[0].requiredPermission).toBe("billing.view");
    expect(await as(t, w.amani.userId).query(api.notifications.inbox.latest, {})).toEqual([]);
  });

  test("outside channels run only when enabled, with the recipient's language", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const t = newTest();
    const w = await world(t);
    await send(t, { type: "plan.activated", plan: "pro", periodEnd: NOW }, { userId: w.amani.userId }, "a");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(log).not.toHaveBeenCalled();
    vi.stubEnv("NOTIFY_CHANNELS", "log");
    await send(t, { type: "plan.activated", plan: "pro", periodEnd: NOW }, { userId: w.amani.userId }, "b");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(log.mock.calls.flat().join(" ")).toMatch(/plan\.activated \(fr\)/);
    log.mockRestore();
  });
});

describe("inbox", () => {
  test("signed-out callers are refused; suspended accounts too", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(t.query(api.notifications.inbox.unreadCount, {})).rejects.toThrow(/NOT_AUTHENTICATED/);
    await expect(as(t, w.gone).query(api.notifications.inbox.latest, {})).rejects.toThrow(/ACCOUNT_SUSPENDED/);
  });

  test("only your own rows: reading, marking read", async () => {
    const t = newTest();
    const w = await world(t);
    await send(t, activated, { userId: w.amani.userId }, "x");
    const [mine] = await as(t, w.amani.userId).query(api.notifications.inbox.latest, {});
    expect(await as(t, w.boss).query(api.notifications.inbox.latest, {})).toEqual([]);
    await expect(as(t, w.boss).mutation(api.notifications.inbox.markRead, { id: mine._id })).rejects.toThrow(/NOT_FOUND/);
    await as(t, w.amani.userId).mutation(api.notifications.inbox.markRead, { id: mine._id });
    expect(await as(t, w.amani.userId).query(api.notifications.inbox.latest, {})).toMatchObject([{ read: true }]);
  });

  test("losing the permission hides the notification at once", async () => {
    const t = newTest();
    const w = await world(t);
    await send(t, summary(3), { permission: "billing.view" }, "s");
    const finance = as(t, w.finance);
    const [row] = await finance.query(api.notifications.inbox.latest, {});
    expect(await finance.query(api.notifications.inbox.unreadCount, {})).toEqual({ count: 1, capped: false });
    const roleId = (await t.run((ctx) => ctx.db.get("users", w.finance)))!.roleId!;
    await t.run((ctx) => ctx.db.patch("roles", roleId, { permissions: ["users.view"] }));
    expect(await finance.query(api.notifications.inbox.unreadCount, {})).toEqual({ count: 0, capped: false });
    expect(await finance.query(api.notifications.inbox.latest, {})).toEqual([]);
    expect((await finance.query(api.notifications.inbox.list, { paginationOpts: page })).page).toEqual([]);
    await expect(finance.mutation(api.notifications.inbox.markRead, { id: row._id })).rejects.toThrow(/NOT_FOUND/);
  });

  test("list filters: unread only, category, both", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.amani.userId);
    await send(t, { type: "plan.activated", plan: "pro", periodEnd: NOW }, { userId: w.amani.userId }, "1");
    await send(t, { type: "payment.failed", paymentId: await fakePayment(t, w.amani), plan: "pro" }, { userId: w.amani.userId }, "2");
    const [latest] = await me.query(api.notifications.inbox.latest, {});
    await me.mutation(api.notifications.inbox.markRead, { id: latest._id });
    const list = (args: { unreadOnly?: boolean; category?: "billing" | "changeRequests" }) =>
      me.query(api.notifications.inbox.list, { paginationOpts: page, ...args }).then((r) => r.page.map((n) => n.data.type));
    expect(await list({})).toEqual(["payment.failed", "plan.activated"]);
    expect(await list({ unreadOnly: true })).toEqual(["plan.activated"]);
    expect(await list({ category: "billing", unreadOnly: true })).toEqual(["plan.activated"]);
    expect(await list({ category: "changeRequests" })).toEqual([]);
  });

  test("the unread count stops at the cap; mark all read clears every row", async () => {
    const t = newTest();
    const w = await world(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 250; i++) {
        await ctx.db.insert("notifications", {
          userId: w.amani.userId,
          category: "billing",
          data: { type: "plan.activated", plan: "pro", periodEnd: i },
          dedupeKey: `k${i}`,
        });
      }
    });
    const me = as(t, w.amani.userId);
    expect(await me.query(api.notifications.inbox.unreadCount, {})).toEqual({ count: COUNT_CAP, capped: true });
    await me.mutation(api.notifications.inbox.markAllRead, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await me.query(api.notifications.inbox.unreadCount, {})).toEqual({ count: 0, capped: false });
  });

  test("a suspended shop's seller can still read and clear notifications", async () => {
    const t = newTest();
    const w = await world(t);
    await send(t, activated, { userId: w.amani.userId }, "x");
    await t.run((ctx) => ctx.db.patch("shops", w.amani.shopId, { status: "suspended" }));
    await as(t, w.amani.userId).mutation(api.notifications.inbox.markAllRead, {});
    expect(await as(t, w.amani.userId).query(api.notifications.inbox.unreadCount, {})).toEqual({ count: 0, capped: false });
  });
});

async function fakePayment(t: T, seller: { userId: Id<"users">; shopId: Id<"shops"> }, status: "failed" | "succeeded" = "failed") {
  return await t.run((ctx) =>
    ctx.db.insert("payments", {
      shopId: seller.shopId,
      shopName: "Chez Amani",
      userId: seller.userId,
      plan: "pro",
      amountMinor: 29900,
      currency: "KES",
      provider: "mock",
      status,
    }),
  );
}

describe("change request events", () => {
  test("a new request reaches change-request admins, never its own shop's owner", async () => {
    const t = newTest();
    const w = await world(t);
    const requestId = await as(t, w.amani.userId).mutation(api.changeRequests.create, {
      field: "name",
      newValue: "Maison Amani",
      reason: REASON,
    });
    for (const id of [w.boss, w.support]) {
      expect((await rowsOf(t, id)).map((r) => r.data)).toEqual([
        { type: "changeRequest.submitted", requestId, shopName: "Chez Amani", field: "name" },
      ]);
    }
    expect(await rowsOf(t, w.finance)).toEqual([]);
    expect(await rowsOf(t, w.amani.userId)).toEqual([]);
  });

  test("a risky name is one flagged notification (not two)", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.amani.userId).mutation(api.changeRequests.create, { field: "slug", newValue: "amani-paypal", reason: REASON });
    expect((await rowsOf(t, w.support)).map((r) => r.data)).toMatchObject([
      { type: "changeRequest.flagged", field: "slug", value: "amani-paypal", brand: "paypal" },
    ]);
  });

  test("an approved WhatsApp change is shown masked", async () => {
    const t = newTest();
    const w = await world(t);
    const requestId = await t.run((ctx) =>
      ctx.db.insert("shopChangeRequests", {
        shopId: w.amani.shopId,
        requesterId: w.amani.userId,
        field: "whatsapp",
        oldValue: "+243812345678",
        newValue: "+243899999123",
        reason: REASON,
        status: "pending",
        flags: [],
        shopName: "Chez Amani",
        searchText: "Chez Amani",
      }),
    );
    await as(t, w.boss).mutation(api.admin.changeRequests.approve, { requestId, overrideCooldown: false });
    expect((await rowsOf(t, w.amani.userId))[0].data).toMatchObject({ type: "changeRequest.approved", value: "+243 ••• ••• 123" });
  });
});

describe("billing events", () => {
  beforeEach(() => {
    vi.stubEnv("PAYMENTS_PROVIDER", "mock");
    vi.stubEnv("PAYMENTS_MOCK_ENABLED", "true");
  });

  async function checkout(t: T, userId: Id<"users">, shopId: Id<"shops">) {
    await setSubscription(t, shopId, { plan: "free", status: "free" });
    const paymentId = await as(t, userId).mutation(api.billing.startCheckout, { plan: "pro" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return paymentId;
  }

  test("a failed payment reaches the payer and billing admins, once", async () => {
    const t = newTest();
    const w = await world(t);
    const paymentId = await checkout(t, w.amani.userId, w.amani.shopId);
    const fail = () => t.mutation(internal.payments.core.applyResult, { provider: "mock", event: mockEvent(paymentId, "failed") });
    await fail();
    await fail();
    expect(await typesOf(t, w.amani.userId)).toEqual(["payment.failed"]);
    for (const id of [w.boss, w.finance]) {
      expect((await rowsOf(t, id)).map((r) => r.data)).toMatchObject([
        { type: "admin.paymentFailed", paymentId, shopName: "Chez Amani", amount: "299 KES" },
      ]);
    }
    expect(await rowsOf(t, w.support)).toEqual([]);
  });

  test("a successful payment tells the seller the plan is active", async () => {
    const t = newTest();
    const w = await world(t);
    const paymentId = await checkout(t, w.amani.userId, w.amani.shopId);
    await t.mutation(internal.payments.core.applyResult, { provider: "mock", event: mockEvent(paymentId, "succeeded") });
    expect((await rowsOf(t, w.amani.userId)).map((r) => r.data)).toMatchObject([{ type: "plan.activated", plan: "pro" }]);
  });

  test("an admin grant also notifies the seller", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.boss).mutation(api.admin.billing.grant, { shopId: w.amani.shopId, plan: "business", days: 30, reason: "Partner programme" });
    expect((await rowsOf(t, w.amani.userId)).map((r) => r.data)).toEqual([
      { type: "plan.activated", plan: "business", periodEnd: NOW + 30 * DAY_MS },
    ]);
  });

  test("an ended trial tells the seller (trial: true)", async () => {
    const t = newTest();
    const w = await world(t);
    await setSubscription(t, w.amani.shopId, { plan: "pro", status: "trialing", periodEnd: NOW - 1 });
    await t.mutation(internal.billingJobs.expireDue, {});
    expect((await rowsOf(t, w.amani.userId)).map((r) => r.data)).toEqual([{ type: "plan.expired", plan: "pro", trial: true }]);
  });
});

describe("notificationJobs", () => {
  test("endingSoon warns each seller once per period and sends admins one summary a day", async () => {
    const t = newTest();
    const w = await world(t);
    const zawadi = await sellerWithShop(t, "zawadi@shop.ke", { slug: "zawadi", name: "Zawadi" });
    const far = await sellerWithShop(t, "far@shop.ke", { slug: "far-away", name: "Far" });
    const end = NOW + 3 * DAY_MS;
    await setSubscription(t, w.amani.shopId, { plan: "pro", status: "trialing", periodEnd: end });
    await setSubscription(t, zawadi.shopId, { plan: "business", status: "active", periodEnd: end });
    await setSubscription(t, far.shopId, { plan: "pro", status: "trialing", periodEnd: NOW + 30 * DAY_MS });

    expect(await t.mutation(internal.notificationJobs.endingSoon, {})).toBe(2);
    expect(await t.mutation(internal.notificationJobs.endingSoon, {})).toBe(2);
    expect((await rowsOf(t, w.amani.userId)).map((r) => r.data)).toEqual([
      { type: "plan.endingSoon", plan: "pro", trial: true, periodEnd: end },
    ]);
    expect((await rowsOf(t, zawadi.userId))[0].data).toMatchObject({ trial: false, plan: "business" });
    expect(await rowsOf(t, far.userId)).toEqual([]);
    expect((await rowsOf(t, w.finance)).map((r) => r.data)).toEqual([
      { type: "admin.endingSoon", count: 2, capped: false, day: "2026-11-19" },
    ]);
    expect(await rowsOf(t, w.support)).toEqual([]);
  });

  test("cleanup deletes notifications past the retention, read or not", async () => {
    const t = newTest();
    const w = await world(t);
    await send(t, activated, { userId: w.amani.userId }, "old");
    vi.setSystemTime(NOW + (NOTIFICATION_RETENTION_DAYS - 1) * DAY_MS);
    await send(t, activated, { userId: w.amani.userId }, "new");
    expect(await t.mutation(internal.notificationJobs.cleanup, {})).toBe(0);
    vi.setSystemTime(NOW + (NOTIFICATION_RETENTION_DAYS + 1) * DAY_MS);
    expect(await t.mutation(internal.notificationJobs.cleanup, {})).toBe(1);
    expect((await rowsOf(t, w.amani.userId)).map((r) => r.dedupeKey)).toEqual(["new"]);
  });
});

describe("admin.attention.counts", () => {
  test("live numbers from the real tables; null without the permission", async () => {
    const t = newTest();
    const w = await world(t);
    const zawadi = await sellerWithShop(t, "zawadi@shop.ke", { slug: "zawadi", name: "Zawadi" });
    const ask = (userId: Id<"users">, field: "name" | "slug", newValue: string) =>
      as(t, userId).mutation(api.changeRequests.create, { field, newValue, reason: REASON });
    await ask(w.amani.userId, "slug", "amani-paypal");
    await ask(zawadi.userId, "name", "Zawadi Shoes");
    await setSubscription(t, w.amani.shopId, { plan: "pro", status: "trialing", periodEnd: NOW + DAY_MS });
    await setSubscription(t, zawadi.shopId, { plan: "pro", status: "active", periodEnd: NOW + 30 * DAY_MS });
    await fakePayment(t, w.amani);
    await fakePayment(t, zawadi);
    vi.setSystemTime(NOW + 1000);
    await fakePayment(t, zawadi, "succeeded"); // paid since: resolved

    const one = { count: 1, capped: false };
    expect(await as(t, w.boss).query(api.admin.attention.counts, { now: NOW + 2000 })).toEqual({
      pendingChangeRequests: { count: 2, capped: false },
      flaggedChangeRequests: one,
      failedPayments: one,
      endingSoon: one,
    });
    expect(await as(t, w.support).query(api.admin.attention.counts, { now: NOW })).toMatchObject({
      pendingChangeRequests: { count: 2 },
      failedPayments: null,
      endingSoon: null,
    });
    expect(await as(t, w.finance).query(api.admin.attention.counts, { now: NOW })).toMatchObject({
      pendingChangeRequests: null,
      flaggedChangeRequests: null,
    });
    // Old failures drop out of the window.
    expect(
      (await as(t, w.boss).query(api.admin.attention.counts, { now: NOW + 8 * DAY_MS })).failedPayments,
    ).toEqual({ count: 0, capped: false });
    await expect(as(t, w.amani.userId).query(api.admin.attention.counts, { now: NOW })).rejects.toThrow(/FORBIDDEN/);
  });

  test("the change-request list can show flagged requests only", async () => {
    const t = newTest();
    const w = await world(t);
    const zawadi = await sellerWithShop(t, "zawadi@shop.ke", { slug: "zawadi", name: "Zawadi" });
    await as(t, w.amani.userId).mutation(api.changeRequests.create, { field: "slug", newValue: "amani-paypal", reason: REASON });
    await as(t, zawadi.userId).mutation(api.changeRequests.create, { field: "name", newValue: "Zawadi Shoes", reason: REASON });
    const list = await as(t, w.support).query(api.admin.changeRequests.list, { paginationOpts: page, status: "pending", flagged: true });
    expect(list.page.map((r) => r.newValue)).toEqual(["amani-paypal"]);
  });
});

describe("migrations.notificationsV1", () => {
  test("moves old seller notifications into the inbox, keeping read state", async () => {
    const t = newTest();
    const w = await world(t);
    const requestId = await as(t, w.amani.userId).mutation(api.changeRequests.create, {
      field: "name",
      newValue: "Maison Amani",
      reason: REASON,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch("shopChangeRequests", requestId, { status: "rejected", decisionReason: "Not now." });
      await ctx.db.insert("sellerNotifications", {
        userId: w.amani.userId,
        shopId: w.amani.shopId,
        kind: "changeRequest.rejected",
        requestId,
        readAt: 5,
      });
    });
    expect(await t.mutation(internal.migrations.notificationsV1, {})).toBe("started");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(internal.migrations.notificationsV1Status, {})).toEqual({ status: "done", left: 0 });
    expect(await rowsOf(t, w.amani.userId)).toMatchObject([
      { readAt: 5, data: { type: "changeRequest.rejected", requestId, value: "Maison Amani", reason: "Not now." } },
    ]);
  });
});

describe("notificationHref", () => {
  test("links each type to its page", () => {
    expect(notificationHref({ type: "plan.expired", plan: "pro", trial: false })).toBe("/dashboard/billing");
    expect(notificationHref(summary(2))).toBe("/admin/subscriptions?endsFrom=2026-11-19&endsTo=2026-11-26");
    expect(
      notificationHref({
        type: "admin.paymentFailed",
        paymentId: "p" as Id<"payments">,
        shopId: "s" as Id<"shops">,
        shopName: "Chez Amani",
        plan: "pro",
        amount: "1",
      }),
    ).toBe("/admin/payments?status=failed&search=Chez+Amani");
  });
});
