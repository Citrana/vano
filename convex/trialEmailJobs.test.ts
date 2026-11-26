import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { readPlanConfig, writePlanConfig } from "./lib/planConfig";
import { DAY_MS, GRACE_MS } from "./lib/plans";
import { TRIAL_EMAILS_PER_DAY, TRIAL_EMAIL_SPACING_MS } from "./lib/trialEmails";
import { insertProducts, newTest, sellerWithShop, setSubscription, type T } from "./lib/test.utils";

const NOW = Date.parse("2026-11-26T06:00:00Z");
type Queued = { to: string; subject: string; html: string; text: string };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  process.env.SITE_URL = "http://localhost:3000";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Trial emails waiting in the scheduler (welcome emails left out). */
async function queued(t: T): Promise<Queued[]> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs
    .filter((j) => j.name.includes("emails/send"))
    .map((j) => j.args[0] as Queued)
    .filter((e) => !/Welcome|Bienvenue/.test(e.subject));
}

async function plannedSends(t: T) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs
    .filter((j) => j.name.includes("trialEmailJobs") && j.state.kind === "pending")
    .map((j) => ({ ...(j.args[0] as { shopId: Id<"shops">; kind: string; trialEnd: number }), at: j.scheduledTime }));
}

const records = (t: T) => t.run((ctx) => ctx.db.query("trialEmails").collect());

let n = 0;
async function shopOnTrial(t: T, endsIn: number, overrides: { language?: "en" | "fr" } = {}) {
  n++;
  const seller = await sellerWithShop(t, `s${n}@x.com`, { slug: `shop-${n}`, language: overrides.language ?? "en" });
  await setSubscription(t, seller.shopId, { plan: "pro", status: "trialing", periodEnd: NOW + endsIn, source: "trial" });
  return seller;
}

describe("trialEmailJobs.send", () => {
  test("7 days left: built numbers above 0 only, Free card lines, Choose a plan", async () => {
    const t = newTest();
    const { shopId } = await shopOnTrial(t, 7 * DAY_MS);
    await insertProducts(t, shopId, 4);
    await t.run((ctx) =>
      ctx.db.insert("shopDailyStats", { shopId, day: "2026-11-26", shopViews: 12, productViews: 3, whatsappClicks: 0 }),
    );

    expect(await t.mutation(internal.trialEmailJobs.send, { shopId, kind: "days7", trialEnd: NOW + 7 * DAY_MS })).toBe(true);
    const [email] = await queued(t);
    expect(email.to).toBe(`s${n}@x.com`);
    expect(email.subject).toBe("7 days left on your Pro trial");
    expect(email.text).toContain("4 products in your shop");
    expect(email.text).toContain("12 visits to your shop");
    expect(email.text).not.toContain("taps on Order on WhatsApp");
    expect(email.text).toContain("What you keep on Free");
    expect(email.text).toContain("- Up to 10 products");
    expect(email.text).toContain("Choose a plan: http://localhost:3000/dashboard/billing");
    expect(await records(t)).toMatchObject([{ shopId, kind: "days7", trialEnd: NOW + 7 * DAY_MS, day: "2026-11-26" }]);
  });

  test("7 days left with nothing built yet: encouraging line, no empty list", async () => {
    const t = newTest();
    const { shopId } = await shopOnTrial(t, 7 * DAY_MS);
    await t.mutation(internal.trialEmailJobs.send, { shopId, kind: "days7", trialEnd: NOW + 7 * DAY_MS });
    const [email] = await queued(t);
    expect(email.text).toContain("Your shop is ready whenever you are");
    expect(email.text).not.toContain("During your trial");
  });

  test("2 days left: what pauses, products over the limit, real price from the config", async () => {
    const t = newTest();
    const { shopId } = await shopOnTrial(t, 2 * DAY_MS);
    await insertProducts(t, shopId, 13);
    await t.run(async (ctx) => {
      const config = await readPlanConfig(ctx);
      await writePlanConfig(
        ctx,
        { plans: { ...config.plans, pro: { ...config.plans.pro, monthlyMinor: 39900 } }, features: config.features },
        config.version,
        null,
      );
    });

    await t.mutation(internal.trialEmailJobs.send, { shopId, kind: "days2", trialEnd: NOW + 2 * DAY_MS });
    const [email] = await queued(t);
    expect(email.subject).toBe("Your Pro trial ends in 2 days");
    expect(email.text).toContain("You keep Pro for 3 more days after that");
    expect(email.text).toContain("- Offers: sales and discount codes");
    expect(email.text).toContain("- Extra shop looks");
    expect(email.text).toContain("- Shop stats");
    expect(email.text).toContain("3 products over the Free limit of 10 are hidden from your shop");
    // Intl puts a no-break space between the currency and the number.
    expect(email.text.replace(/\u00a0/g, " ")).toContain("Keep Pro (Ksh 399/month): http://localhost:3000/dashboard/billing");
  });

  test("ended: French shop, data safe, upgrade button", async () => {
    const t = newTest();
    const { shopId } = await shopOnTrial(t, -GRACE_MS - 1, { language: "fr" });
    await t.mutation(internal.billingJobs.expireDue, {});
    const sub = await t.run((ctx) => ctx.db.query("subscriptions").withIndex("by_shopId", (q) => q.eq("shopId", shopId)).unique());

    expect(await t.mutation(internal.trialEmailJobs.send, { shopId, kind: "ended", trialEnd: sub!.trialEndedAt! })).toBe(true);
    const [email] = await queued(t);
    expect(email.subject).toBe("Vous êtes maintenant sur Gratuit");
    expect(email.text).toContain("rien n'est supprimé");
    expect(email.text).toContain("Changer de forfait: http://localhost:3000/dashboard/billing");
    expect(email.html).toContain('lang="fr"');
  });

  test("nothing is sent once the owner paid, upgraded to Business or got a grant", async () => {
    const t = newTest();
    const states = [
      { plan: "pro" as const, status: "active" as const, source: "payment" as const },
      { plan: "business" as const, status: "active" as const, source: "payment" as const },
      { plan: "business" as const, status: "active" as const, source: "admin" as const },
    ];
    for (const state of states) {
      const { shopId } = await shopOnTrial(t, 2 * DAY_MS);
      await setSubscription(t, shopId, { ...state, periodEnd: NOW + 30 * DAY_MS });
      expect(await t.mutation(internal.trialEmailJobs.send, { shopId, kind: "days2", trialEnd: NOW + 2 * DAY_MS })).toBe(false);
    }
    expect(await queued(t)).toEqual([]);
    expect(await records(t)).toEqual([]);
  });

  test("an extended trial drops the email for the old date and follows the new one", async () => {
    const t = newTest();
    const { shopId } = await shopOnTrial(t, 7 * DAY_MS);
    await setSubscription(t, shopId, { plan: "pro", status: "trialing", periodEnd: NOW + 20 * DAY_MS, source: "admin" });
    expect(await t.mutation(internal.trialEmailJobs.send, { shopId, kind: "days7", trialEnd: NOW + 7 * DAY_MS })).toBe(false);
    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(0);

    vi.setSystemTime(NOW + 13 * DAY_MS);
    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(1);
    expect(await plannedSends(t)).toMatchObject([{ shopId, kind: "days7", trialEnd: NOW + 20 * DAY_MS }]);
  });

  test("sending twice records and sends once", async () => {
    const t = newTest();
    const { shopId } = await shopOnTrial(t, 2 * DAY_MS);
    const args = { shopId, kind: "days2" as const, trialEnd: NOW + 2 * DAY_MS };
    expect(await t.mutation(internal.trialEmailJobs.send, args)).toBe(true);
    expect(await t.mutation(internal.trialEmailJobs.send, args)).toBe(false);
    expect(await queued(t)).toHaveLength(1);
    expect(await records(t)).toHaveLength(1);
  });

  test("suspended shop, missing SITE_URL: nothing sent or recorded (due again next run)", async () => {
    const t = newTest();
    const a = await shopOnTrial(t, 2 * DAY_MS);
    await t.run((ctx) => ctx.db.patch("shops", a.shopId, { status: "suspended" }));
    expect(await t.mutation(internal.trialEmailJobs.send, { shopId: a.shopId, kind: "days2", trialEnd: NOW + 2 * DAY_MS })).toBe(false);

    const b = await shopOnTrial(t, 2 * DAY_MS);
    delete process.env.SITE_URL;
    expect(await t.mutation(internal.trialEmailJobs.send, { shopId: b.shopId, kind: "days2", trialEnd: NOW + 2 * DAY_MS })).toBe(false);
    expect(await records(t)).toEqual([]);
    process.env.SITE_URL = "http://localhost:3000";
    expect(await t.mutation(internal.trialEmailJobs.send, { shopId: b.shopId, kind: "days2", trialEnd: NOW + 2 * DAY_MS })).toBe(true);
  });
});

describe("trialEmailJobs.plan", () => {
  test("schedules due shops a minute apart, most urgent first, never twice", async () => {
    const t = newTest();
    const soon = await shopOnTrial(t, 7 * DAY_MS);
    const last = await shopOnTrial(t, 2 * DAY_MS);
    await shopOnTrial(t, 10 * DAY_MS); // not yet
    const ended = await shopOnTrial(t, -GRACE_MS - 1);
    await t.mutation(internal.billingJobs.expireDue, {});

    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(3);
    const planned = await plannedSends(t);
    expect(planned.map((p) => [p.shopId, p.kind, p.at - NOW])).toEqual([
      [last.shopId, "days2", 0],
      [ended.shopId, "ended", TRIAL_EMAIL_SPACING_MS],
      [soon.shopId, "days7", 2 * TRIAL_EMAIL_SPACING_MS],
    ]);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await records(t)).toHaveLength(3);
    expect(await queued(t)).toHaveLength(3);
    // The job running again the same day (or a retry) sends nothing new.
    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(0);
  });

  test("a shop that paid between planning and sending gets nothing", async () => {
    const t = newTest();
    const { shopId } = await shopOnTrial(t, 2 * DAY_MS);
    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(1);
    await setSubscription(t, shopId, { plan: "pro", status: "active", periodEnd: NOW + 32 * DAY_MS, source: "payment" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await records(t)).toEqual([]);
    expect(await queued(t)).toEqual([]);
  });

  test("a Get Business sign-up (Free, no trial) and an old trial end get nothing", async () => {
    const t = newTest();
    const a = await sellerWithShop(t, "free@x.com", { slug: "free-shop" });
    await setSubscription(t, a.shopId, { plan: "free", status: "free" });
    const b = await sellerWithShop(t, "old@x.com", { slug: "old-shop" });
    await setSubscription(t, b.shopId, { plan: "free", status: "free", trialEndedAt: NOW - 8 * DAY_MS });
    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(0);
  });

  test(`at most ${TRIAL_EMAILS_PER_DAY} a day; the rest go the next day`, async () => {
    const t = newTest();
    const total = TRIAL_EMAILS_PER_DAY + 5;
    for (let i = 0; i < total; i++) await shopOnTrial(t, i < 5 ? 2 * DAY_MS : 5 * DAY_MS);

    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(TRIAL_EMAILS_PER_DAY);
    const first = await plannedSends(t);
    // The 2-day ones go first.
    expect(first.slice(0, 5).every((p) => p.kind === "days2")).toBe(true);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await records(t)).toHaveLength(TRIAL_EMAILS_PER_DAY);
    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(0);

    vi.setSystemTime(NOW + DAY_MS);
    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(5);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await records(t)).toHaveLength(total);
  });

  test("one failing send doesn't stop the others; it is due again next run", async () => {
    const t = newTest();
    const broken = await shopOnTrial(t, 2 * DAY_MS);
    const fine = await shopOnTrial(t, 2 * DAY_MS);
    // An unreadable owner address makes only that shop's send skip.
    await t.run(async (ctx) => {
      const shop = await ctx.db.get("shops", broken.shopId);
      await ctx.db.patch("users", shop!.ownerId, { email: "not-an-email" });
    });
    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(2);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await records(t)).map((r) => r.shopId)).toEqual([fine.shopId]);

    vi.setSystemTime(NOW + DAY_MS);
    expect(await plannedSends(t)).toEqual([]);
    expect(await t.mutation(internal.trialEmailJobs.plan, {})).toBe(1);
  });

  test("records go when the shop is purged", async () => {
    const t = newTest();
    const { shopId } = await shopOnTrial(t, 2 * DAY_MS);
    await t.mutation(internal.trialEmailJobs.send, { shopId, kind: "days2", trialEnd: NOW + 2 * DAY_MS });
    await t.mutation(internal.admin.shops.purgeShop, { shopId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await records(t)).toEqual([]);
  });
});
