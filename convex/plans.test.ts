import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { DEFAULT_PLAN_CONFIG } from "./lib/planDefaults";
import { as, builtInRoles, insertUserWithRole, newTest } from "./lib/test.utils";

describe("plans.catalog (public)", () => {
  test("works signed out, matches the seed, has no personal data", async () => {
    const t = newTest();
    const catalog = await t.query(api.plans.catalog, {});
    expect(catalog).toMatchObject({ currency: "KES", trialPlan: "pro", trialMonths: 2 });
    expect(catalog.plans.map((p) => [p.id, p.monthlyMinor, p.visible])).toEqual([
      ["free", 0, true],
      ["pro", 29900, true],
      ["business", 100000, true],
      ["enterprise", null, true],
    ]);
    const json = JSON.stringify(catalog);
    expect(json).not.toMatch(/ownerId|updatedBy|@/);
    // Features come in pricing order, with resolved values.
    const orders = catalog.features.map((f) => f.pricing.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(catalog.features.find((f) => f.key === "shopStats")?.values).toEqual({ free: false, pro: true, business: true, enterprise: true });
  });

  test("follows admin changes (hidden plan, trial length)", async () => {
    const t = newTest();
    const roles = await builtInRoles(t);
    const admin = as(t, await insertUserWithRole(t, "boss@vano.app", roles.super_admin));
    const v1 = await admin.mutation(api.admin.plans.updatePlan, {
      expectedVersion: 0,
      plan: "business",
      settings: { ...DEFAULT_PLAN_CONFIG.plans.business, visible: false },
    });
    await admin.mutation(api.admin.plans.updatePlan, {
      expectedVersion: v1,
      plan: "pro",
      settings: { ...DEFAULT_PLAN_CONFIG.plans.pro, trialMonths: 3 },
    });
    const catalog = await t.query(api.plans.catalog, {});
    expect(catalog.plans.find((p) => p.id === "business")?.visible).toBe(false);
    expect(catalog.trialMonths).toBe(3);
  });
});
