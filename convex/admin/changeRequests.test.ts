import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SLUG_REDIRECT_DAYS } from "../lib/changeRequests";
import { DAY_MS } from "../lib/plans";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  sellerWithShop,
  type T,
} from "../lib/test.utils";

const REASON = "We moved to a new location and renamed the brand.";
const page = { numItems: 20, cursor: null };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function world(t: T) {
  const ids = await builtInRoles(t);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const viewer = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Viewer", ["changeRequests.view"]));
  const amani = await sellerWithShop(t, "amani@shop.cd", { slug: "chez-amani", name: "Chez Amani" });
  const zawadi = await sellerWithShop(t, "zawadi@shop.ke", { slug: "zawadi", name: "Zawadi Shoes" });
  return { admin, viewer, amani, zawadi };
}

function ask(t: T, userId: Id<"users">, field: "name" | "slug", newValue: string) {
  return as(t, userId).mutation(api.changeRequests.create, { field, newValue, reason: REASON });
}

const shopOf = (t: T, shopId: Id<"shops">) => t.run((ctx) => ctx.db.get("shops", shopId));
const actions = async (t: T) => (await t.run((ctx) => ctx.db.query("auditLogs").collect())).map((e) => e.action);

describe("admin.changeRequests permissions", () => {
  test("view to list and read; decide to approve or reject; never your own shop", async () => {
    const t = newTest();
    const w = await world(t);
    const id = await ask(t, w.amani.userId, "name", "Maison Amani");
    // A seller can't see the admin list.
    await expect(as(t, w.amani.userId).query(api.admin.changeRequests.list, { paginationOpts: page })).rejects.toThrow(
      /FORBIDDEN/,
    );
    const list = await as(t, w.viewer).query(api.admin.changeRequests.list, { paginationOpts: page });
    expect(list.page).toHaveLength(1);
    await expect(
      as(t, w.viewer).mutation(api.admin.changeRequests.approve, { requestId: id, overrideCooldown: false }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.viewer).mutation(api.admin.changeRequests.reject, { requestId: id, reason: "No thanks" })).rejects.toThrow(
      /FORBIDDEN/,
    );

    // An admin who also sells can't decide on their own shop.
    const ids = await builtInRoles(t);
    const sellingAdmin = await insertUserWithRole(t, "both@vano.app", ids.super_admin);
    await as(t, sellingAdmin).mutation(api.shops.create, {
      name: "Admin Shop",
      slug: "admin-shop",
      currency: "USD",
      language: "en",
      categories: ["clothes"],
      whatsappNumber: "+243812345670",
      city: "Goma",
      country: "CD",
    });
    const own = await ask(t, sellingAdmin, "name", "Admin Boutique");
    await expect(
      as(t, sellingAdmin).mutation(api.admin.changeRequests.approve, { requestId: own, overrideCooldown: false }),
    ).rejects.toThrow(/CANNOT_MODIFY_SELF/);
  });
});

describe("admin.changeRequests.list", () => {
  test("filters by status, field, date and searches shop name or new value", async () => {
    const t = newTest();
    const w = await world(t);
    await ask(t, w.amani.userId, "name", "Maison Amani");
    vi.setSystemTime(Date.now() + 2 * DAY_MS);
    await ask(t, w.zawadi.userId, "slug", "zawadi-shoes");
    const me = as(t, w.admin);
    const list = (args: object) =>
      me.query(api.admin.changeRequests.list, { paginationOpts: page, ...args }).then((r) => r.page.map((x) => x.newValue));

    expect(await list({})).toEqual(["zawadi-shoes", "Maison Amani"]);
    expect(await list({ field: "slug" })).toEqual(["zawadi-shoes"]);
    expect(await list({ status: "approved" })).toEqual([]);
    expect(await list({ status: "pending", field: "name" })).toEqual(["Maison Amani"]);
    expect(await list({ to: Date.now() - DAY_MS })).toEqual(["Maison Amani"]);
    expect(await list({ from: Date.now() - DAY_MS })).toEqual(["zawadi-shoes"]);
    expect(await list({ search: "Zawadi" })).toEqual(["zawadi-shoes"]);
    expect(await list({ search: "Amani", field: "slug" })).toEqual([]);
  });
});

describe("admin.changeRequests.get", () => {
  test("shows the request, shop age, products, history and link availability", async () => {
    const t = newTest();
    const w = await world(t);
    const first = await ask(t, w.amani.userId, "name", "Maison Amani");
    await as(t, w.amani.userId).mutation(api.changeRequests.cancel, { requestId: first });
    const id = await ask(t, w.amani.userId, "slug", "maison-amani");
    const detail = await as(t, w.viewer).query(api.admin.changeRequests.get, { requestId: id });
    expect(detail).toMatchObject({
      request: { field: "slug", newValue: "maison-amani", oldValue: "chez-amani", reason: REASON },
      shop: { name: "Chez Amani", currentValue: "chez-amani", productCount: 0, ownerEmail: "amani@shop.cd" },
      slugAvailable: true,
      competingRequests: 0,
      isOwnShop: false,
    });
    expect(detail?.history.map((r) => r.status)).toEqual(["cancelled"]);
    expect(await as(t, w.viewer).query(api.admin.changeRequests.get, { requestId: "nope" })).toBeNull();
  });
});

describe("admin.changeRequests.approve", () => {
  test("applies a name change, syncs copies, notifies and logs", async () => {
    const t = newTest();
    const w = await world(t);
    const id = await ask(t, w.amani.userId, "name", "Maison Amani");
    await as(t, w.admin).mutation(api.admin.changeRequests.approve, { requestId: id, overrideCooldown: false });
    expect((await shopOf(t, w.amani.shopId))?.name).toBe("Maison Amani");
    const sub = await t.run((ctx) =>
      ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", w.amani.shopId)).unique(),
    );
    expect(sub?.shopName).toBe("Maison Amani");
    expect(await actions(t)).toEqual(expect.arrayContaining(["changeRequest.approved", "shop.nameChanged"]));

    const inbox = await as(t, w.amani.userId).query(api.notifications.inbox.latest, {});
    expect(inbox).toMatchObject([
      { read: false, data: { type: "changeRequest.approved", requestId: id, field: "name", value: "Maison Amani" } },
    ]);
    await expect(
      as(t, w.admin).mutation(api.admin.changeRequests.approve, { requestId: id, overrideCooldown: false }),
    ).rejects.toThrow(/REQUEST_NOT_PENDING/);
  });

  test("a link change redirects and reserves the old link, then frees it after expiry", async () => {
    const t = newTest();
    const w = await world(t);
    const id = await ask(t, w.amani.userId, "slug", "maison-amani");
    await as(t, w.admin).mutation(api.admin.changeRequests.approve, { requestId: id, overrideCooldown: false });
    expect((await shopOf(t, w.amani.shopId))?.slug).toBe("maison-amani");
    expect(await t.query(api.public.slugRedirect, { slug: "chez-amani" })).toEqual({ slug: "maison-amani" });
    expect(await t.query(api.public.shopBasics, { slug: "chez-amani" })).toBeNull();

    // Another shop can't take the old link while it redirects.
    expect(await as(t, w.zawadi.userId).query(api.shops.checkSlug, { slug: "chez-amani" })).toEqual({
      ok: false,
      problem: "taken",
    });
    await expect(ask(t, w.zawadi.userId, "slug", "chez-amani")).rejects.toThrow(/SLUG_TAKEN/);

    vi.setSystemTime(Date.now() + (SLUG_REDIRECT_DAYS + 1) * DAY_MS);
    await t.mutation(internal.changeRequestJobs.cleanup, {});
    expect(await t.query(api.public.slugRedirect, { slug: "chez-amani" })).toBeNull();
    await ask(t, w.zawadi.userId, "slug", "chez-amani");
  });

  test("a→b→c redirects to the current link; taking an old link back removes its redirect", async () => {
    const t = newTest();
    const w = await world(t);
    const approve = (requestId: Id<"shopChangeRequests">) =>
      as(t, w.admin).mutation(api.admin.changeRequests.approve, { requestId, overrideCooldown: true });
    await approve(await ask(t, w.amani.userId, "slug", "amani-b"));
    await approve(await ask(t, w.amani.userId, "slug", "amani-c"));
    expect(await t.query(api.public.slugRedirect, { slug: "chez-amani" })).toEqual({ slug: "amani-c" });
    expect(await t.query(api.public.slugRedirect, { slug: "amani-b" })).toEqual({ slug: "amani-c" });
    await approve(await ask(t, w.amani.userId, "slug", "chez-amani"));
    expect((await shopOf(t, w.amani.shopId))?.slug).toBe("chez-amani");
    expect(await t.query(api.public.slugRedirect, { slug: "chez-amani" })).toBeNull();
  });

  test("two shops asking for the same link: the second approval fails cleanly", async () => {
    const t = newTest();
    const w = await world(t);
    const first = await ask(t, w.amani.userId, "slug", "goma-style");
    const second = await ask(t, w.zawadi.userId, "slug", "goma-style");
    const detail = await as(t, w.admin).query(api.admin.changeRequests.get, { requestId: second });
    expect(detail?.competingRequests).toBe(1);
    // Approved at the same time: Convex runs them as serializable transactions.
    const results = await Promise.allSettled([
      as(t, w.admin).mutation(api.admin.changeRequests.approve, { requestId: first, overrideCooldown: false }),
      as(t, w.admin).mutation(api.admin.changeRequests.approve, { requestId: second, overrideCooldown: false }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(rejected.reason)).toMatch(/SLUG_TAKEN/);
    const slugs = [(await shopOf(t, w.amani.shopId))?.slug, (await shopOf(t, w.zawadi.shopId))?.slug];
    expect(slugs.filter((s) => s === "goma-style")).toHaveLength(1);
  });

  test("inside the cooldown it needs an explicit override, which is logged", async () => {
    const t = newTest();
    const w = await world(t);
    const me = as(t, w.admin);
    await me.mutation(api.admin.changeRequests.approve, {
      requestId: await ask(t, w.amani.userId, "name", "Maison Amani"),
      overrideCooldown: false,
    });
    vi.setSystemTime(Date.now() + 3 * DAY_MS);
    const id = await ask(t, w.amani.userId, "name", "Amani Mode");
    await expect(me.mutation(api.admin.changeRequests.approve, { requestId: id, overrideCooldown: false })).rejects.toThrow(
      /CHANGE_COOLDOWN/,
    );
    await me.mutation(api.admin.changeRequests.approve, { requestId: id, overrideCooldown: true });
    const request = await t.run((ctx) => ctx.db.get("shopChangeRequests", id));
    expect(request).toMatchObject({ status: "approved", cooldownOverridden: true });
    const logs = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(logs.filter((e) => e.action === "changeRequest.approved").at(-1)?.details).toMatchObject({
      cooldownOverridden: true,
    });
  });

  test("applies a WhatsApp change", async () => {
    vi.stubEnv("VERIFICATION_SENDER", "log");
    vi.stubEnv("VERIFICATION_TEST_MODE", "true");
    const t = newTest();
    const w = await world(t);
    const seller = as(t, w.amani.userId);
    const sent = await seller.mutation(api.changeRequests.sendPhoneCode, { phone: "+243899000111" });
    await seller.mutation(api.changeRequests.verifyPhoneCode, { verificationId: sent.verificationId, code: sent.devCode! });
    const id = await seller.mutation(api.changeRequests.create, {
      field: "whatsapp",
      newValue: "+243899000111",
      reason: REASON,
      verificationId: sent.verificationId,
    });
    await as(t, w.admin).mutation(api.admin.changeRequests.approve, { requestId: id, overrideCooldown: false });
    expect((await shopOf(t, w.amani.shopId))?.whatsappNumber).toBe("+243899000111");
    const logs = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(logs.find((e) => e.action === "shop.whatsappChanged")?.details).toMatchObject({
      from: "+243 ••• ••• 678",
      to: "+243 ••• ••• 111",
    });
  });
});

describe("admin.changeRequests.reject", () => {
  test("needs a reason, leaves the shop unchanged and tells the seller why", async () => {
    const t = newTest();
    const w = await world(t);
    const id = await ask(t, w.amani.userId, "name", "Gucci Goma");
    const me = as(t, w.admin);
    await expect(me.mutation(api.admin.changeRequests.reject, { requestId: id, reason: " no " })).rejects.toThrow(
      /REASON_INVALID/,
    );
    await me.mutation(api.admin.changeRequests.reject, { requestId: id, reason: "Brand names aren't allowed." });
    expect((await shopOf(t, w.amani.shopId))?.name).toBe("Chez Amani");
    const mine = await as(t, w.amani.userId).query(api.changeRequests.mine, {});
    expect(mine.requests[0]).toMatchObject({ status: "rejected", decisionReason: "Brand names aren't allowed." });
    const seller = as(t, w.amani.userId);
    const [notice] = await seller.query(api.notifications.inbox.latest, {});
    expect(notice.data).toMatchObject({ type: "changeRequest.rejected", reason: "Brand names aren't allowed." });
    expect(await actions(t)).toContain("changeRequest.rejected");

    // Marking read: only your own.
    await expect(as(t, w.zawadi.userId).mutation(api.notifications.inbox.markRead, { id: notice._id })).rejects.toThrow(
      /NOT_FOUND/,
    );
    await seller.mutation(api.notifications.inbox.markAllRead, {});
    expect(await seller.query(api.notifications.inbox.unreadCount, {})).toEqual({ count: 0, capped: false });
  });
});

describe("notification channels", () => {
  test("outside channels get the decision in a scheduled action", async () => {
    vi.stubEnv("NOTIFY_CHANNELS", "log");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const t = newTest();
    const w = await world(t);
    const id = await ask(t, w.amani.userId, "name", "Maison Amani");
    await as(t, w.admin).mutation(api.admin.changeRequests.reject, { requestId: id, reason: "Not now, sorry." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(log.mock.calls.flat().join(" ")).toMatch(/changeRequest\.rejected.*Not now, sorry\./);
    log.mockRestore();
  });
});
