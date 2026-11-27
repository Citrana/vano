import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { TEAM_ROLES } from "./lib/team";
import { formatBillingDate } from "./lib/planEmails";
import { DAY_MS, GRACE_MS, formatPlanPrice } from "./lib/plans";
import { as, builtInRoles, insertUser, insertUserWithRole, newTest, sellerWithShop, setSubscription, type T } from "./lib/test.utils";
import { mockRef } from "./payments/mock";

/**
 * Plan emails end to end (docs/payments.md section 15): receipts from
 * confirmed payments only, once; downgrade confirmations once per change;
 * nothing for failed payments or admin changes.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-11-27T10:00:00Z"));
  vi.stubEnv("PAYMENTS_PROVIDER", "mock");
  vi.stubEnv("PAYMENTS_MOCK_ENABLED", "true");
  vi.stubEnv("SITE_URL", "https://vano.app");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

type Queued = { to: string; subject: string; html: string; text: string };

async function queued(t: T): Promise<Queued[]> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((j) => j.name.includes("emails/send")).map((j) => j.args[0] as Queued);
}
const receipts = async (t: T) => (await queued(t)).filter((e) => /^(Receipt|Reçu)/.test(e.subject));
const confirmations = async (t: T) => (await queued(t)).filter((e) => /^(Confirmed|Confirmé)/.test(e.subject));
const paymentOf = (t: T, id: Id<"payments">) => t.run((ctx) => ctx.db.get("payments", id));
const subOf = (t: T, shopId: Id<"shops">) =>
  t.run((ctx) => ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique());

async function pay(t: T, me: ReturnType<typeof as>, plan: "pro" | "business") {
  const paymentId = await me.mutation(api.billing.startCheckout, { plan });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return paymentId;
}

describe("payment receipts", () => {
  test("trial → Business: one upgrade receipt to the owner, trial ended, unlocks, even when replayed", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t, "Owner@Shop.cd", { language: "en" });
    const me = as(t, seller.userId);
    const paymentId = await pay(t, me, "business");
    expect(await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" })).toBe("applied");

    const [email, ...rest] = await receipts(t);
    expect(rest).toHaveLength(0);
    expect(email.to).toBe("owner@shop.cd");
    expect(email.subject).toBe("Receipt: you're now on Business");
    expect(email.text).toContain(`Amount paid: ${formatPlanPrice(100000, "en")}`);
    expect(email.text).toContain(`Payment date: ${formatBillingDate(Date.now(), "en")}`);
    expect(email.text).toContain(`Payment reference: ${mockRef(paymentId)}`);
    expect(email.text).toContain(`New end date: ${formatBillingDate(Date.now() + 30 * DAY_MS, "en")}`);
    expect(email.text).toContain("Your free trial ended today because Business starts now.");
    expect(email.text).toContain("Now unlocked");
    expect(email.text).toContain("https://vano.app/dashboard/billing");
    expect((await paymentOf(t, paymentId))?.receiptEmailAt).toBe(Date.now());

    // The same result again, or a later poll: nothing more.
    expect(await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" })).toBe("duplicate");
    await t.mutation(internal.payments.core.applyResult, {
      provider: "mock",
      event: { eventId: "late-poll", providerRef: mockRef(paymentId), outcome: "succeeded" },
    });
    expect(await receipts(t)).toHaveLength(1);
  });

  test("trial → Pro: a renewal receipt that says the trial days were kept, in the shop's language", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t, "seller@example.com", { language: "fr" });
    const trialEnd = (await subOf(t, seller.shopId))!.periodEnd!;
    const me = as(t, seller.userId);
    const paymentId = await pay(t, me, "pro");
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" });

    const [email] = await receipts(t);
    expect(email.subject).toBe(`Reçu : Pro renouvelé jusqu'au ${formatBillingDate(trialEnd + 30 * DAY_MS, "fr")}`);
    expect(email.text).toContain("Vos jours d'essai gratuit sont conservés");
    expect(email.text).not.toContain("Maintenant débloqué");
  });

  test("paid Pro → Business shows the credit for unused Pro days", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t, "seller@example.com", { language: "en" });
    const now = Date.now();
    await setSubscription(t, seller.shopId, {
      plan: "pro",
      status: "active",
      periodEnd: now + 10 * DAY_MS,
      paidStart: now - 20 * DAY_MS,
      paidEnd: now + 10 * DAY_MS,
      source: "payment",
    });
    const me = as(t, seller.userId);
    const paymentId = await pay(t, me, "business");
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" });
    const [email] = await receipts(t);
    expect(email.text).toContain(`Credit for unused Pro days: −${formatPlanPrice(10000, "en")}`);
    expect(email.text).toContain(`Amount paid: ${formatPlanPrice(90000, "en")}`);
  });

  test("failed, pending and cancelled payments send nothing", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    const me = as(t, seller.userId);
    const failed = await pay(t, me, "pro");
    await me.mutation(api.billing.mockSimulate, { paymentId: failed, outcome: "failed" });
    const pending = await pay(t, me, "pro");
    await me.mutation(api.billing.mockSimulate, { paymentId: pending, outcome: "pending" });
    await me.mutation(api.billing.cancelCheckout, { paymentId: pending });
    expect(await receipts(t)).toHaveLength(0);
    expect((await paymentOf(t, failed))?.receiptEmailAt).toBeUndefined();
  });

  test("no SITE_URL or no owner address: the payment still applies, no email", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    const me = as(t, seller.userId);
    const paymentId = await pay(t, me, "business");
    vi.stubEnv("SITE_URL", "");
    expect(await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" })).toBe("applied");
    expect((await subOf(t, seller.shopId))?.plan).toBe("business");
    expect(await receipts(t)).toHaveLength(0);
    expect((await paymentOf(t, paymentId))?.receiptEmailAt).toBeUndefined();
  });

  test("admin grants and extensions send no plan email", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    const roles = await builtInRoles(t);
    const admin = as(t, await insertUserWithRole(t, "boss@vano.app", roles.super_admin));
    await admin.mutation(api.admin.billing.grant, { shopId: seller.shopId, plan: "business", days: 30, reason: "Partner shop" });
    await admin.mutation(api.admin.billing.extend, { shopId: seller.shopId, days: 10, reason: "Support delay" });
    expect(await receipts(t)).toHaveLength(0);
    expect(await confirmations(t)).toHaveLength(0);
  });
});

describe("downgrade confirmation", () => {
  async function businessSeller(t: T, email = "seller@example.com", slug = "chez-amani") {
    const seller = await sellerWithShop(t, email, { slug, language: "en" });
    const periodEnd = Date.now() + 20 * DAY_MS;
    await setSubscription(t, seller.shopId, { plan: "business", status: "active", periodEnd });
    return { ...seller, me: as(t, seller.userId), periodEnd };
  }

  test("one email per change, with dates, what pauses and Keep my plan; same choice twice = one email", async () => {
    const t = newTest();
    const { me, periodEnd } = await businessSeller(t);
    const changeId = await me.mutation(api.billing.scheduleDowngrade, { plan: "free" });

    const [email, ...rest] = await confirmations(t);
    expect(rest).toHaveLength(0);
    expect(email.subject).toBe(`Confirmed: your shop moves to Free on ${formatBillingDate(periodEnd, "en")}`);
    expect(email.text).toContain("This is not a payment");
    expect(email.text).toContain(`Your shop moves to Free on: ${formatBillingDate(periodEnd + GRACE_MS, "en")}`);
    expect(email.text).toContain("Your data is kept");
    expect(email.text).toContain(`Keep my plan: https://vano.app/dashboard/billing?keep=${changeId}`);
    expect((await me.query(api.billing.mine, {})).pendingChange).toEqual({ _id: changeId, toPlan: "free", effectiveAt: periodEnd });

    expect(await me.mutation(api.billing.scheduleDowngrade, { plan: "free" })).toBe(changeId);
    expect(await confirmations(t)).toHaveLength(1);

    // Another lower plan is a new change: the old one is replaced, one more email.
    const toPro = await me.mutation(api.billing.scheduleDowngrade, { plan: "pro" });
    expect(toPro).not.toBe(changeId);
    expect((await t.run((ctx) => ctx.db.get("planChanges", changeId)))?.status).toBe("replaced");
    const all = await confirmations(t);
    expect(all).toHaveLength(2);
    expect(all[1].text).toContain("Get Pro (");
  });

  test("Keep my plan cancels it once; another shop's change is NOT_FOUND", async () => {
    const t = newTest();
    const { me } = await businessSeller(t);
    const other = await businessSeller(t, "other@example.com", "autre-shop");
    const changeId = await me.mutation(api.billing.scheduleDowngrade, { plan: "free" });

    await expect(other.me.mutation(api.billing.keepPlan, { changeId })).rejects.toThrow(/NOT_FOUND/);
    await me.mutation(api.billing.keepPlan, { changeId });
    expect((await me.query(api.billing.mine, {})).pendingChange).toBeNull();
    await expect(me.mutation(api.billing.keepPlan, { changeId })).rejects.toThrow(/NOT_FOUND/);
    const actions = await t.run(async (ctx) => (await ctx.db.query("auditLogs").collect()).map((l) => l.action));
    expect(actions).toEqual(expect.arrayContaining(["subscription.downgradeScheduled", "subscription.downgradeKept"]));
  });

  test("only real downgrades: an upgrade or Free → Free is PLAN_INVALID", async () => {
    const t = newTest();
    const seller = await sellerWithShop(t);
    const me = as(t, seller.userId);
    await setSubscription(t, seller.shopId, { plan: "pro", status: "active", periodEnd: Date.now() + 20 * DAY_MS });
    await expect(me.mutation(api.billing.scheduleDowngrade, { plan: "business" })).rejects.toThrow(/PLAN_INVALID/);
    await setSubscription(t, seller.shopId, { plan: "free", status: "free" });
    await expect(me.mutation(api.billing.scheduleDowngrade, { plan: "free" })).rejects.toThrow(/PLAN_INVALID/);
    expect(await confirmations(t)).toHaveLength(0);
  });

  test("a payment afterwards closes the pending change", async () => {
    const t = newTest();
    const { me } = await businessSeller(t);
    await me.mutation(api.billing.scheduleDowngrade, { plan: "free" });
    const paymentId = await pay(t, me, "business");
    await me.mutation(api.billing.mockSimulate, { paymentId, outcome: "succeeded" });
    expect((await me.query(api.billing.mine, {})).pendingChange).toBeNull();
  });

  test("a team member (even a manager) can't choose a plan", async () => {
    expect(TEAM_ROLES.manager).not.toContain("ownBilling.manage");
    const t = newTest();
    const { me } = await businessSeller(t);
    const { token } = await me.mutation(api.team.createInvite, { role: "manager", language: "en" });
    const managerId = await insertUser(t, "manager@team.cd");
    await as(t, managerId).mutation(api.team.acceptInvite, { token });
    await expect(as(t, managerId).mutation(api.billing.scheduleDowngrade, { plan: "free" })).rejects.toThrow(/FORBIDDEN/);
  });
});
