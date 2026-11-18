import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { CHANGE_COOLDOWN_DAYS, CODE_MAX_ATTEMPTS } from "./lib/changeRequests";
import { DAY_MS } from "./lib/plans";
import { as, insertUser, newTest, sellerWithShop, type T } from "./lib/test.utils";

const REASON = "We moved to a new location and renamed the brand.";
const NEW_PHONE = "+243899000111";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
  vi.stubEnv("VERIFICATION_SENDER", "log");
  vi.stubEnv("VERIFICATION_TEST_MODE", "true");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const requestsOf = (t: T, shopId: Id<"shops">) =>
  t.run((ctx) => ctx.db.query("shopChangeRequests").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).collect());
const audit = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());

/** Sends and verifies a code for `phone`; returns the verification id. */
async function verifiedPhone(t: T, userId: Id<"users">, phone = NEW_PHONE) {
  const me = as(t, userId);
  const sent = await me.mutation(api.changeRequests.sendPhoneCode, { phone });
  expect(sent.devCode).toMatch(/^\d{6}$/);
  expect(await me.mutation(api.changeRequests.verifyPhoneCode, { verificationId: sent.verificationId, code: sent.devCode! })).toEqual({ ok: true });
  return sent.verificationId;
}

describe("changeRequests.create", () => {
  test("records a pending request, leaves the shop unchanged and logs it", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const me = as(t, userId);
    await me.mutation(api.changeRequests.create, { field: "name", newValue: "  Maison  Amani ", reason: REASON });
    const [request] = await requestsOf(t, shopId);
    expect(request).toMatchObject({
      field: "name",
      oldValue: "Chez Amani",
      newValue: "Maison Amani",
      status: "pending",
      flags: [],
      requesterId: userId,
    });
    expect((await me.query(api.shops.myShop, {}))?.name).toBe("Chez Amani");
    expect((await audit(t)).map((e) => e.action)).toContain("changeRequest.created");
  });

  test("validates the value, the reason and same-value requests", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    const ask = (field: "name" | "slug" | "whatsapp", newValue: string, reason = REASON) =>
      me.mutation(api.changeRequests.create, { field, newValue, reason });
    await expect(ask("name", "A")).rejects.toThrow(/NAME_INVALID/);
    await expect(ask("name", "Chez Amani")).rejects.toThrow(/CHANGE_SAME_VALUE/);
    await expect(ask("slug", "Bad Slug")).rejects.toThrow(/SLUG_INVALID/);
    await expect(ask("slug", "dashboard")).rejects.toThrow(/SLUG_RESERVED/);
    await expect(ask("slug", "chez-amani")).rejects.toThrow(/CHANGE_SAME_VALUE/);
    await expect(ask("name", "Maison Amani", "too short")).rejects.toThrow(/CHANGE_REASON_INVALID/);
    await expect(ask("whatsapp", "12")).rejects.toThrow(/PHONE_INVALID/);
  });

  test("one pending request per field; cancel frees it", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    const id = await me.mutation(api.changeRequests.create, { field: "slug", newValue: "maison-amani", reason: REASON });
    await expect(
      me.mutation(api.changeRequests.create, { field: "slug", newValue: "amani-mode", reason: REASON }),
    ).rejects.toThrow(/CHANGE_PENDING/);
    // Another field is independent.
    await me.mutation(api.changeRequests.create, { field: "name", newValue: "Maison Amani", reason: REASON });
    await me.mutation(api.changeRequests.cancel, { requestId: id });
    await me.mutation(api.changeRequests.create, { field: "slug", newValue: "amani-mode", reason: REASON });
  });

  test("a link used by another shop, or reserved by its old link, is taken", async () => {
    const t = newTest();
    await sellerWithShop(t, "a@x.com", { slug: "zawadi" });
    const { userId, shopId } = await sellerWithShop(t, "b@x.com", { slug: "chez-amani" });
    const me = as(t, userId);
    await expect(
      me.mutation(api.changeRequests.create, { field: "slug", newValue: "zawadi", reason: REASON }),
    ).rejects.toThrow(/SLUG_TAKEN/);
    const other = await t.run((ctx) => ctx.db.query("shops").withIndex("by_slug", (q) => q.eq("slug", "zawadi")).unique());
    await t.run((ctx) =>
      ctx.db.insert("slugRedirects", { fromSlug: "old-zawadi", shopId: other!._id, expiresAt: Date.now() + DAY_MS }),
    );
    await expect(
      me.mutation(api.changeRequests.create, { field: "slug", newValue: "old-zawadi", reason: REASON }),
    ).rejects.toThrow(/SLUG_TAKEN/);
    // Its own old link can be asked back.
    await t.run((ctx) => ctx.db.insert("slugRedirects", { fromSlug: "my-old-link", shopId, expiresAt: Date.now() + DAY_MS }));
    await me.mutation(api.changeRequests.create, { field: "slug", newValue: "my-old-link", reason: REASON });
  });

  test("flags brand names and requests inside the cooldown", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const me = as(t, userId);
    await me.mutation(api.changeRequests.create, { field: "name", newValue: "Gucci Goma", reason: REASON });
    let [request] = await requestsOf(t, shopId);
    expect(request).toMatchObject({ flags: ["brand"], matchedBrand: "gucci" });

    await t.run((ctx) => ctx.db.patch("shopChangeRequests", request._id, { status: "approved", decidedAt: Date.now() }));
    vi.setSystemTime(Date.now() + 5 * DAY_MS);
    await me.mutation(api.changeRequests.create, { field: "name", newValue: "Maison Amani", reason: REASON });
    request = (await requestsOf(t, shopId)).find((r) => r.status === "pending")!;
    expect(request.flags).toEqual(["cooldown"]);

    await me.mutation(api.changeRequests.cancel, { requestId: request._id });
    vi.setSystemTime(Date.now() + CHANGE_COOLDOWN_DAYS * DAY_MS);
    await me.mutation(api.changeRequests.create, { field: "name", newValue: "Maison Amani", reason: REASON });
    request = (await requestsOf(t, shopId)).find((r) => r.status === "pending")!;
    expect(request.flags).toEqual([]);
  });

  test("rejects signed-out callers, sellers without a shop and suspended shops", async () => {
    const t = newTest();
    const args = { field: "name" as const, newValue: "Maison Amani", reason: REASON };
    await expect(t.mutation(api.changeRequests.create, args)).rejects.toThrow(/NOT_AUTHENTICATED/);
    const noShop = as(t, await insertUser(t, "new@x.com"));
    await expect(noShop.mutation(api.changeRequests.create, args)).rejects.toThrow(/NO_SHOP/);
    const { userId, shopId } = await sellerWithShop(t);
    await t.run((ctx) => ctx.db.patch("shops", shopId, { status: "suspended" }));
    await expect(as(t, userId).mutation(api.changeRequests.create, args)).rejects.toThrow(/SHOP_SUSPENDED/);
  });
});

describe("changeRequests WhatsApp verification", () => {
  test("a new number needs a verified code for that exact number, used once", async () => {
    const t = newTest();
    const { userId, shopId } = await sellerWithShop(t);
    const me = as(t, userId);
    const ask = (verificationId?: Id<"phoneVerifications">, newValue = NEW_PHONE) =>
      me.mutation(api.changeRequests.create, { field: "whatsapp", newValue, reason: REASON, verificationId });
    await expect(ask()).rejects.toThrow(/PHONE_NOT_VERIFIED/);

    const sent = await me.mutation(api.changeRequests.sendPhoneCode, { phone: "+243 899 000 111" });
    expect(sent.phone).toBe(NEW_PHONE);
    // Sent but not verified yet.
    await expect(ask(sent.verificationId)).rejects.toThrow(/PHONE_NOT_VERIFIED/);

    vi.setSystemTime(Date.now() + 61_000);
    const verificationId = await verifiedPhone(t, userId);
    // Verified for another number.
    await expect(ask(verificationId, "+243899000222")).rejects.toThrow(/PHONE_NOT_VERIFIED/);
    await ask(verificationId);
    const [request] = await requestsOf(t, shopId);
    expect(request).toMatchObject({ field: "whatsapp", newValue: NEW_PHONE, oldValue: "+243812345678" });
    // The phone number never reaches the activity log in clear.
    const created = (await audit(t)).find((e) => e.action === "changeRequest.created");
    expect(created?.details?.newValue).toBe("+243 ••• ••• 111");
    // Used once.
    await me.mutation(api.changeRequests.cancel, { requestId: request._id });
    await expect(ask(verificationId)).rejects.toThrow(/PHONE_NOT_VERIFIED/);
  });

  test("a verified code expires if not used in time", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const verificationId = await verifiedPhone(t, userId);
    vi.setSystemTime(Date.now() + 31 * 60_000);
    await expect(
      as(t, userId).mutation(api.changeRequests.create, {
        field: "whatsapp",
        newValue: NEW_PHONE,
        reason: REASON,
        verificationId,
      }),
    ).rejects.toThrow(/PHONE_NOT_VERIFIED/);
  });

  test("wrong codes are counted and lock the code; expired codes fail", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    const sent = await me.mutation(api.changeRequests.sendPhoneCode, { phone: NEW_PHONE });
    const wrong = sent.devCode === "000000" ? "111111" : "000000";
    for (let i = 1; i < CODE_MAX_ATTEMPTS; i++) {
      expect(await me.mutation(api.changeRequests.verifyPhoneCode, { verificationId: sent.verificationId, code: wrong })).toEqual({
        ok: false,
        code: "CODE_INVALID",
      });
    }
    expect(await me.mutation(api.changeRequests.verifyPhoneCode, { verificationId: sent.verificationId, code: wrong })).toEqual({
      ok: false,
      code: "CODE_TOO_MANY_ATTEMPTS",
    });
    // Even the right code is refused now.
    expect(
      await me.mutation(api.changeRequests.verifyPhoneCode, { verificationId: sent.verificationId, code: sent.devCode! }),
    ).toEqual({ ok: false, code: "CODE_TOO_MANY_ATTEMPTS" });

    vi.setSystemTime(Date.now() + 61_000);
    const again = await me.mutation(api.changeRequests.sendPhoneCode, { phone: NEW_PHONE });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    expect(
      await me.mutation(api.changeRequests.verifyPhoneCode, { verificationId: again.verificationId, code: again.devCode! }),
    ).toEqual({ ok: false, code: "CODE_EXPIRED" });
  });

  test("codes are rate limited per shop", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    await me.mutation(api.changeRequests.sendPhoneCode, { phone: NEW_PHONE });
    await expect(me.mutation(api.changeRequests.sendPhoneCode, { phone: NEW_PHONE })).rejects.toThrow(/CODE_RATE_LIMITED/);
    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(Date.now() + 61_000);
      await me.mutation(api.changeRequests.sendPhoneCode, { phone: NEW_PHONE });
    }
    vi.setSystemTime(Date.now() + 61_000);
    await expect(me.mutation(api.changeRequests.sendPhoneCode, { phone: NEW_PHONE })).rejects.toThrow(/CODE_RATE_LIMITED/);
  });

  test("no code on screen outside test mode; no sender means unavailable", async () => {
    const t = newTest();
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    vi.stubEnv("VERIFICATION_TEST_MODE", "");
    const sent = await me.mutation(api.changeRequests.sendPhoneCode, { phone: NEW_PHONE });
    expect(sent.devCode).toBeNull();
    const stored = await t.run((ctx) => ctx.db.get("phoneVerifications", sent.verificationId));
    expect(stored?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    vi.stubEnv("VERIFICATION_SENDER", "");
    vi.setSystemTime(Date.now() + 61_000);
    await expect(me.mutation(api.changeRequests.sendPhoneCode, { phone: NEW_PHONE })).rejects.toThrow(
      /VERIFICATION_UNAVAILABLE/,
    );
  });

  test("refuses the current number and another seller's verification", async () => {
    const t = newTest();
    const a = await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
    const b = await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
    await expect(
      as(t, a.userId).mutation(api.changeRequests.sendPhoneCode, { phone: "+243812345678" }),
    ).rejects.toThrow(/CHANGE_SAME_VALUE/);
    const verificationId = await verifiedPhone(t, a.userId);
    await expect(
      as(t, b.userId).mutation(api.changeRequests.verifyPhoneCode, { verificationId, code: "123456" }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      as(t, b.userId).mutation(api.changeRequests.create, {
        field: "whatsapp",
        newValue: NEW_PHONE,
        reason: REASON,
        verificationId,
      }),
    ).rejects.toThrow(/PHONE_NOT_VERIFIED/);
  });
});

describe("changeRequests.cancel and mine", () => {
  test("only your own pending request; mine lists yours only", async () => {
    const t = newTest();
    const a = await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
    const b = await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
    const id = await as(t, a.userId).mutation(api.changeRequests.create, {
      field: "name",
      newValue: "Maison Amani",
      reason: REASON,
    });
    await expect(as(t, b.userId).mutation(api.changeRequests.cancel, { requestId: id })).rejects.toThrow(/NOT_FOUND/);
    expect((await as(t, b.userId).query(api.changeRequests.mine, {})).requests).toEqual([]);

    const mine = await as(t, a.userId).query(api.changeRequests.mine, {});
    expect(mine.requests).toHaveLength(1);
    expect(mine.requests[0]).toMatchObject({ field: "name", newValue: "Maison Amani", status: "pending" });
    expect(mine.lastApproved).toEqual({ name: null, slug: null, whatsapp: null });
    expect(mine.verificationAvailable).toBe(true);

    await as(t, a.userId).mutation(api.changeRequests.cancel, { requestId: id });
    await expect(as(t, a.userId).mutation(api.changeRequests.cancel, { requestId: id })).rejects.toThrow(
      /REQUEST_NOT_PENDING/,
    );
    expect((await audit(t)).map((e) => e.action)).toContain("changeRequest.cancelled");
  });
});
