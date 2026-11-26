import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { readPlanConfig, writePlanConfig } from "../lib/planConfig";
import { as, insertUser, newTest, shopArgs } from "../lib/test.utils";
import { EMAIL_COLORS } from "./layout";
import { welcomeEmail } from "./templates/welcome";

type T = ReturnType<typeof newTest>;
type Queued = { to: string; subject: string; html: string; text: string };

/** Welcome emails waiting in the scheduler (`emails.send.deliver`). */
async function queued(t: T): Promise<Queued[]> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((j) => j.name.includes("emails/send")).map((j) => j.args[0] as Queued);
}

const sentAt = (t: T, userId: Parameters<typeof as>[1]) =>
  t.run(async (ctx) => (await ctx.db.get("users", userId))?.welcomeEmailSentAt ?? null);

const URLS = { dashboardUrl: "https://vano.app/dashboard", helpUrl: "https://vano.app/help" };

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  process.env.SITE_URL = "http://localhost:3000";
  vi.restoreAllMocks();
});

describe("welcomeEmail template", () => {
  test("EN: subject, trial, 3 steps, dashboard button, tip and help", () => {
    const { subject, html, text } = welcomeEmail("en", { ...URLS, trial: { months: 2, planName: "Pro" } });
    expect(subject).toBe("Welcome to Vano, your shop is ready to set up");
    expect(text).toContain("Your first 2 months on Pro are free, and no payment method is needed.");
    expect(text).toContain("1. Set up your shop");
    expect(text).toContain("2. Add your first products");
    expect(text).toContain("3. Share your link");
    expect(text).toContain("Go to my dashboard: https://vano.app/dashboard");
    expect(text).toContain("https://vano.app/help");
    expect(text).toContain("Tip: try a different shop look");
    expect(html).toContain('href="https://vano.app/dashboard"');
    expect(html).toContain(EMAIL_COLORS.plum);
    expect(html).toContain('lang="en"');
    expect(html).not.toMatch(/<style|var\(--/);
    expect(text).not.toContain("<");
  });

  test("FR, one-month wording, and no trial line without a trial", () => {
    const fr = welcomeEmail("fr", { ...URLS, trial: { months: 1, planName: "Pro" } });
    expect(fr.subject).toBe("Bienvenue sur Vano, votre boutique est prête à être configurée");
    expect(fr.text).toContain("Votre premier mois sur Pro est gratuit");
    expect(fr.text).toContain("Aller à mon tableau de bord");
    expect(fr.html).toContain('lang="fr"');

    const none = welcomeEmail("en", { ...URLS, trial: null });
    expect(none.text).not.toMatch(/free|payment method/i);
    expect(none.text).toContain("1. Set up your shop");
  });
});

describe("shops.create sends the welcome email", () => {
  test("once, to the new owner, in the shop's language, with the configured trial", async () => {
    const t = newTest();
    const userId = await insertUser(t, "Amani@Example.com");
    await as(t, userId).mutation(api.shops.create, shopArgs({ language: "fr" }));

    const emails = await queued(t);
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("amani@example.com");
    expect(emails[0].subject).toBe("Bienvenue sur Vano, votre boutique est prête à être configurée");
    expect(emails[0].text).toContain("Vos 2 premiers mois sur Pro sont gratuits");
    expect(emails[0].text).toContain("http://localhost:3000/dashboard");
    expect(await sentAt(t, userId)).toEqual(expect.any(Number));

    // A retried create is refused (one shop per user) and queues nothing more.
    await expect(as(t, userId).mutation(api.shops.create, shopArgs({ slug: "autre-shop" }))).rejects.toThrow(/SHOP_EXISTS/);
    expect(await queued(t)).toHaveLength(1);
  });

  test("never twice per account, even if the shop is recreated", async () => {
    const t = newTest();
    const userId = await insertUser(t);
    await t.run((ctx) => ctx.db.patch("users", userId, { welcomeEmailSentAt: 1 }));
    await as(t, userId).mutation(api.shops.create, shopArgs());
    expect(await queued(t)).toHaveLength(0);
    expect(await sentAt(t, userId)).toBe(1);
  });

  test("a 'Get Business' sign-up gets it without the trial line", async () => {
    const t = newTest();
    const userId = await insertUser(t);
    await as(t, userId).mutation(api.shops.create, { ...shopArgs({ language: "en" }), startPlan: "business" });
    const [email] = await queued(t);
    expect(email.subject).toBe("Welcome to Vano, your shop is ready to set up");
    expect(email.text).not.toMatch(/months on|payment method/);
  });

  test("follows the trial length set in Plans & features", async () => {
    const t = newTest();
    await t.run(async (ctx) => {
      const config = await readPlanConfig(ctx);
      await writePlanConfig(
        ctx,
        { plans: { ...config.plans, pro: { ...config.plans.pro, trialMonths: 3 } }, features: config.features },
        config.version,
        null,
      );
    });
    const userId = await insertUser(t);
    await as(t, userId).mutation(api.shops.create, shopArgs({ language: "en" }));
    expect((await queued(t))[0].text).toContain("Your first 3 months on Pro are free");
  });

  test("a missing address or app URL skips the email, never the shop", async () => {
    const t = newTest();
    const noEmail = await t.run((ctx) => ctx.db.insert("users", {}));
    await as(t, noEmail).mutation(api.shops.create, shopArgs({ slug: "no-email" }));

    delete process.env.SITE_URL;
    const noUrl = await insertUser(t, "b@example.com");
    await as(t, noUrl).mutation(api.shops.create, shopArgs({ slug: "no-url" }));

    expect(await queued(t)).toHaveLength(0);
    expect(await sentAt(t, noEmail)).toBeNull();
    expect(await sentAt(t, noUrl)).toBeNull();
    expect(await as(t, noUrl).query(api.shops.myShop, {})).toMatchObject({ slug: "no-url" });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("SITE_URL"));
  });
});
