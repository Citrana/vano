import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { DEFAULT_PLAN_CONFIG } from "../lib/planDefaults";
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

const audit = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());

async function world(t: T) {
  const roles = await builtInRoles(t);
  const boss = await insertUserWithRole(t, "boss@vano.app", roles.super_admin);
  const planner = await insertUserWithRole(t, "plans@vano.app", await insertRole(t, "Planner", ["plans.manage"]));
  const billing = await insertUserWithRole(t, "billing@vano.app", await insertRole(t, "Billing", ["billing.view", "billing.manage"]));
  return { boss: as(t, boss), planner: as(t, planner), billing: as(t, billing) };
}

describe("admin.plans access", () => {
  test("needs plans.manage (super admin has it); sellers and other admins are refused", async () => {
    const t = newTest();
    const w = await world(t);
    const seller = await sellerWithShop(t);
    await expect(w.boss.query(api.admin.plans.get, {})).resolves.toMatchObject({ version: 0 });
    await expect(w.planner.query(api.admin.plans.get, {})).resolves.toBeTruthy();
    await expect(w.billing.query(api.admin.plans.get, {})).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, seller.userId).query(api.admin.plans.get, {})).rejects.toThrow(/FORBIDDEN/);
    await expect(t.query(api.admin.plans.get, {})).rejects.toThrow(/NOT_AUTHENTICATED/);
    await expect(
      w.billing.mutation(api.admin.plans.setFeatureValue, { expectedVersion: 0, feature: "shopStats", plan: "free", value: true }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  test("before any change it reads the seed (nothing changes on day one)", async () => {
    const t = newTest();
    const { planner } = await world(t);
    const config = await planner.query(api.admin.plans.get, {});
    expect(config.plans).toEqual(DEFAULT_PLAN_CONFIG.plans);
    expect(config.features.products).toEqual(DEFAULT_PLAN_CONFIG.features.products);
  });
});

describe("admin.plans writes", () => {
  test("plan edit: validated, versioned and logged field by field", async () => {
    const t = newTest();
    const { planner } = await world(t);
    const pro = DEFAULT_PLAN_CONFIG.plans.pro;
    const version = await planner.mutation(api.admin.plans.updatePlan, {
      expectedVersion: 0,
      plan: "pro",
      settings: { ...pro, name: { en: " Pro Plus ", fr: "Pro Plus" }, monthlyMinor: 34900 },
    });
    expect(version).toBe(1);
    const config = await planner.query(api.admin.plans.get, {});
    expect(config.plans.pro).toMatchObject({ name: { en: "Pro Plus", fr: "Pro Plus" }, monthlyMinor: 34900 });
    const logs = (await audit(t)).filter((l) => l.action === "plans.planUpdated");
    expect(logs.map((l) => l.details)).toEqual([
      { plan: "pro", field: "name.en", from: "Pro", to: "Pro Plus" },
      { plan: "pro", field: "name.fr", from: "Pro", to: "Pro Plus" },
      { plan: "pro", field: "monthlyMinor", from: 29900, to: 34900 },
    ]);
    expect(logs[0]).toMatchObject({ actorEmail: "plans@vano.app", targetType: "planConfig", targetId: "pro" });
    // Same values again: nothing written, no version bump.
    await expect(
      planner.mutation(api.admin.plans.updatePlan, { expectedVersion: 1, plan: "pro", settings: config.plans.pro }),
    ).resolves.toBe(1);
  });

  test("refuses empty names, negative or zero paid prices, bad trials, hiding every plan", async () => {
    const t = newTest();
    const { planner } = await world(t);
    const plans = DEFAULT_PLAN_CONFIG.plans;
    const bad = [
      { plan: "pro" as const, settings: { ...plans.pro, name: { en: "", fr: "Pro" } } },
      { plan: "pro" as const, settings: { ...plans.pro, monthlyMinor: -100 } },
      { plan: "business" as const, settings: { ...plans.business, monthlyMinor: 0 } },
      { plan: "free" as const, settings: { ...plans.free, monthlyMinor: 500 } },
      { plan: "pro" as const, settings: { ...plans.pro, yearlyMinor: 99_999_999 } },
      { plan: "pro" as const, settings: { ...plans.pro, trialMonths: 40 } },
    ];
    for (const b of bad) {
      await expect(planner.mutation(api.admin.plans.updatePlan, { expectedVersion: 0, ...b })).rejects.toThrow(/PLAN_CONFIG_INVALID/);
    }
    let version = 0;
    for (const plan of ["free", "pro", "business"] as const) {
      version = await planner.mutation(api.admin.plans.updatePlan, { expectedVersion: version, plan, settings: { ...plans[plan], visible: false } });
    }
    await expect(
      planner.mutation(api.admin.plans.updatePlan, { expectedVersion: version, plan: "enterprise", settings: { ...plans.enterprise, visible: false } }),
    ).rejects.toThrow(/PLAN_CONFIG_INVALID/);
  });

  test("feature values: no negative limits, no unknown keys, right kind", async () => {
    const t = newTest();
    const { planner } = await world(t);
    const set = (feature: string, value: boolean | number | null) =>
      planner.mutation(api.admin.plans.setFeatureValue, { expectedVersion: 0, feature, plan: "free", value });
    await expect(set("products", -1)).rejects.toThrow(/PLAN_CONFIG_INVALID/);
    await expect(set("photosPerProduct", null)).rejects.toThrow(/PLAN_CONFIG_INVALID/);
    await expect(set("madeUpFeature", true)).rejects.toThrow(/PLAN_CONFIG_INVALID/);
    await expect(set("allLooks", 3)).rejects.toThrow(/PLAN_CONFIG_INVALID/);
    await expect(set("products", 25)).resolves.toBe(1);
    const log = (await audit(t)).find((l) => l.action === "plans.featureUpdated");
    expect(log?.details).toEqual({ feature: "products", plan: "free", from: 10, to: 25 });
  });

  test("a second admin editing an old version is warned, never overwrites", async () => {
    const t = newTest();
    const { planner, boss } = await world(t);
    await boss.mutation(api.admin.plans.setFeatureValue, { expectedVersion: 0, feature: "products", plan: "free", value: 20 });
    await expect(
      planner.mutation(api.admin.plans.setFeatureValue, { expectedVersion: 0, feature: "products", plan: "free", value: 5 }),
    ).rejects.toThrow(/PLAN_CONFIG_STALE/);
    expect((await planner.query(api.admin.plans.get, {})).features.products.values.free).toBe(20);
  });

  test("pricing text: trimmed, validated, logged; optional texts can be cleared", async () => {
    const t = newTest();
    const { planner } = await world(t);
    const pricing = DEFAULT_PLAN_CONFIG.features.salesPromotions.pricing;
    await expect(
      planner.mutation(api.admin.plans.updatePricing, { expectedVersion: 0, feature: "salesPromotions", pricing: { ...pricing, label: { en: "", fr: "x" } } }),
    ).rejects.toThrow(/PLAN_CONFIG_INVALID/);
    const withoutHint = { ...pricing };
    delete withoutHint.hint;
    await planner.mutation(api.admin.plans.updatePricing, {
      expectedVersion: 0,
      feature: "salesPromotions",
      pricing: { ...withoutHint, cardLabel: { en: " Sales and offers ", fr: "Promotions" }, order: 5 },
    });
    const saved = (await planner.query(api.admin.plans.get, {})).features.salesPromotions.pricing;
    expect(saved).toMatchObject({ cardLabel: { en: "Sales and offers", fr: "Promotions" }, order: 5 });
    expect(saved.hint).toBeUndefined();
    const fields = (await audit(t)).filter((l) => l.action === "plans.pricingUpdated").map((l) => l.details?.field);
    expect(fields).toEqual(expect.arrayContaining(["order", "cardLabel.en", "cardLabel.fr", "hint.en", "hint.fr"]));
  });

  test("reset to defaults puts the seed back and is logged", async () => {
    const t = newTest();
    const { planner } = await world(t);
    let version = await planner.mutation(api.admin.plans.setFeatureValue, { expectedVersion: 0, feature: "shopStats", plan: "free", value: true });
    version = await planner.mutation(api.admin.plans.resetToDefaults, { expectedVersion: version });
    const config = await planner.query(api.admin.plans.get, {});
    expect(config.features.shopStats.values.free).toBe(false);
    expect(config.version).toBe(version);
    expect((await audit(t)).find((l) => l.action === "plans.reset")?.details).toMatchObject({ lowered: 1 });
  });
});

describe("admin.plans.impact", () => {
  test("counts the shops on the plans that lose something", async () => {
    const t = newTest();
    const { planner } = await world(t);
    const a = await sellerWithShop(t, "a@x.com", { slug: "shop-a" });
    const b = await sellerWithShop(t, "b@x.com", { slug: "shop-b" });
    const c = await sellerWithShop(t, "c@x.com", { slug: "shop-c" });
    await setSubscription(t, b.shopId, { plan: "business", status: "active", periodEnd: Date.now() + 86_400_000 });
    await setSubscription(t, c.shopId, { plan: "free", status: "free" });
    void a; // a is on the trial (Pro).

    // Pro loses stats: Pro (trial) only; Business keeps its own value.
    const pro = await planner.query(api.admin.plans.impact, { change: { kind: "value", feature: "shopStats", plan: "pro", value: false } });
    expect(pro).toMatchObject({ shops: 1, capped: false, lowered: [{ feature: "shopStats", plan: "pro", enforced: true }] });

    // Free loses products: the free shop.
    const free = await planner.query(api.admin.plans.impact, { change: { kind: "value", feature: "products", plan: "free", value: 5 } });
    expect(free.shops).toBe(1);

    // A pricing-only feature changes no shop.
    const marketing = await planner.query(api.admin.plans.impact, { change: { kind: "value", feature: "customDomain", plan: "business", value: false } });
    expect(marketing).toMatchObject({ shops: 0, lowered: [{ feature: "customDomain", plan: "business", enforced: false }] });

    // Raising a limit takes nothing away.
    expect((await planner.query(api.admin.plans.impact, { change: { kind: "value", feature: "products", plan: "free", value: 50 } })).lowered).toEqual([]);
    // Reset from the seed takes nothing away.
    expect((await planner.query(api.admin.plans.impact, { change: { kind: "reset" } })).lowered).toEqual([]);
  });
});
