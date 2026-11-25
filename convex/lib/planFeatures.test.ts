import { describe, expect, test } from "vitest";
import { LIMITS } from "./catalog";
import { DEFAULT_PLAN_CONFIG } from "./planDefaults";
import {
  FEATURE_FLAGS,
  FEATURE_KEYS,
  applyExceptions,
  featureValueProblem,
  gainedFeatures,
  inheritedFrom,
  isLower,
  loweredFeatures,
  lowestPlanWith,
  planConfigProblem,
  planSettingsProblem,
  pricingProblem,
  resolvePlanLimits,
  resolvedValue,
  withFeatureValue,
} from "./planFeatures";

const SEED = DEFAULT_PLAN_CONFIG;

describe("the seed = the plans as they were in code", () => {
  test("is valid and covers every feature key", () => {
    expect(planConfigProblem(SEED)).toBeNull();
    expect(Object.keys(SEED.features).sort()).toEqual([...FEATURE_KEYS].sort());
  });
  test("limits and features per plan", () => {
    expect(resolvePlanLimits(SEED, "free")).toEqual({ products: 10, photosPerProduct: 3, teamMembers: 0, features: [] });
    expect(resolvePlanLimits(SEED, "pro")).toEqual({
      products: 50,
      photosPerProduct: 6,
      teamMembers: 0,
      features: ["allLooks", "featuredSections", "announcementBar", "shopFilters", "salesPromotions", "shopStats"],
    });
    const business = resolvePlanLimits(SEED, "business");
    expect(business).toMatchObject({ products: null, photosPerProduct: 6, teamMembers: 5 });
    expect([...business.features].sort()).toEqual(["allLooks", "announcementBar", "discountCodes", "featuredSections", "orderTracking", "salesPromotions", "salesReports", "shopFilters", "shopStats", "teamRoles"]);
    const enterprise = resolvePlanLimits(SEED, "enterprise");
    expect(enterprise).toMatchObject({ products: null, teamMembers: 20 });
    expect(enterprise.features).toContain("multiShop");
  });
  test("prices and trial", () => {
    expect(SEED.plans.pro).toMatchObject({ monthlyMinor: 29900, trialMonths: 2 });
    expect(SEED.plans.business.monthlyMinor).toBe(100000);
    expect(SEED.plans.enterprise.monthlyMinor).toBeNull();
  });
  test("limits never exceed the platform ceilings", () => {
    for (const id of ["free", "pro", "business", "enterprise"] as const) {
      const l = resolvePlanLimits(SEED, id);
      expect(l.photosPerProduct).toBeLessThanOrEqual(LIMITS.maxImages);
      if (l.products !== null) expect(l.products).toBeLessThanOrEqual(LIMITS.maxProducts);
    }
  });
});

describe("Business includes everything in Pro", () => {
  test("a flag on Pro is on for Business and Enterprise even if they say off", () => {
    const config = withFeatureValue(withFeatureValue(SEED, "shopStats", "business", false), "shopStats", "enterprise", false);
    expect(resolvedValue(config, "shopStats", "business")).toBe(true);
    expect(inheritedFrom(config, "shopStats", "business")).toBe("pro");
    expect(inheritedFrom(SEED, "shopStats", "business")).toBeNull();
    expect(resolvePlanLimits(config, "enterprise").features).toContain("shopStats");
  });
  test("a limit is at least the lower plan's; unlimited wins", () => {
    const config = withFeatureValue(SEED, "photosPerProduct", "business", 2);
    expect(resolvedValue(config, "photosPerProduct", "business")).toBe(6);
    expect(resolvedValue(withFeatureValue(SEED, "products", "pro", null), "products", "business")).toBeNull();
  });
  test("the cheapest plan with a feature", () => {
    expect(lowestPlanWith(SEED, "allLooks")).toBe("pro");
    expect(lowestPlanWith(withFeatureValue(SEED, "allLooks", "free", true), "allLooks")).toBe("free");
    expect(lowestPlanWith(SEED, "multiShop")).toBe("enterprise");
  });
});

describe("what a change takes away", () => {
  test("turning a flag off on Pro also lowers plans that only had it through Pro", () => {
    const config = withFeatureValue(withFeatureValue(SEED, "shopStats", "business", false), "shopStats", "enterprise", false);
    const after = withFeatureValue(config, "shopStats", "pro", false);
    expect(loweredFeatures(config, after)).toEqual([
      { feature: "shopStats", plan: "pro" },
      { feature: "shopStats", plan: "business" },
      { feature: "shopStats", plan: "enterprise" },
    ]);
  });
  test("raising a limit or adding a feature takes nothing away", () => {
    expect(loweredFeatures(SEED, withFeatureValue(SEED, "products", "free", 20))).toEqual([]);
    expect(loweredFeatures(SEED, withFeatureValue(SEED, "shopStats", "free", true))).toEqual([]);
    expect(loweredFeatures(SEED, withFeatureValue(SEED, "products", "free", 5))).toEqual([{ feature: "products", plan: "free" }]);
    // Enterprise keeps its own "unlimited", so only Business loses.
    expect(loweredFeatures(SEED, withFeatureValue(SEED, "products", "business", 100))).toEqual([
      { feature: "products", plan: "business" },
    ]);
  });
  test("isLower", () => {
    expect(isLower(true, false)).toBe(true);
    expect(isLower(null, 100)).toBe(true);
    expect(isLower(10, null)).toBe(false);
    expect(isLower(10, 10)).toBe(false);
  });
});

describe("shop exceptions", () => {
  const FREE = resolvePlanLimits(SEED, "free");
  test("turn a feature on and raise a limit, never lower it", () => {
    const out = applyExceptions(FREE, [
      { feature: "allLooks", value: true },
      { feature: "products", value: 40 },
      { feature: "photosPerProduct", value: 1 },
    ]);
    expect(out.features).toEqual(["allLooks"]);
    expect(out.products).toBe(40);
    expect(out.photosPerProduct).toBe(3);
    expect(applyExceptions(FREE, [{ feature: "products", value: null }]).products).toBeNull();
    expect(applyExceptions(FREE, [])).toBe(FREE);
  });
});

describe("validation (shared by the admin form and the server)", () => {
  const pro = SEED.plans.pro;
  test("plans", () => {
    expect(planSettingsProblem("pro", { ...pro, name: { en: " ", fr: "Pro" } })).toBe("name");
    expect(planSettingsProblem("pro", { ...pro, monthlyMinor: 0 })).toBe("monthlyPrice");
    expect(planSettingsProblem("pro", { ...pro, monthlyMinor: null })).toBe("monthlyPrice");
    expect(planSettingsProblem("pro", { ...pro, monthlyMinor: -5 })).toBe("monthlyPrice");
    expect(planSettingsProblem("pro", { ...pro, monthlyMinor: 12.5 })).toBe("monthlyPrice");
    expect(planSettingsProblem("free", { ...SEED.plans.free, monthlyMinor: 100 })).toBe("monthlyPrice");
    expect(planSettingsProblem("enterprise", { ...SEED.plans.enterprise, monthlyMinor: 500000 })).toBeNull();
    expect(planSettingsProblem("pro", { ...pro, yearlyMinor: pro.monthlyMinor! * 12 + 1 })).toBe("yearlyPrice");
    expect(planSettingsProblem("pro", { ...pro, trialMonths: 0 })).toBe("trialMonths");
    expect(planSettingsProblem("business", { ...SEED.plans.business, trialMonths: 1 })).toBe("trialMonths");
    const hidden = Object.fromEntries(Object.entries(SEED.plans).map(([id, p]) => [id, { ...p, visible: false }]));
    expect(planConfigProblem({ ...SEED, plans: hidden as typeof SEED.plans })).toBe("noVisiblePlan");
  });
  test("feature values: right kind, never negative, within the ceiling", () => {
    expect(featureValueProblem("products", -1)).toBe("range");
    expect(featureValueProblem("products", LIMITS.maxProducts + 1)).toBe("range");
    expect(featureValueProblem("products", null)).toBeNull();
    expect(featureValueProblem("photosPerProduct", null)).toBe("range");
    expect(featureValueProblem("photosPerProduct", 2.5)).toBe("range");
    expect(featureValueProblem("allLooks", 3)).toBe("kind");
    expect(featureValueProblem("products", true)).toBe("kind");
  });
  test("pricing text", () => {
    const p = SEED.features.products.pricing;
    expect(pricingProblem("products", p)).toBeNull();
    expect(pricingProblem("products", { ...p, label: { en: "", fr: "x" } })).toBe("label");
    expect(pricingProblem("products", { ...p, order: -1 })).toBe("order");
    expect(pricingProblem("products", { ...p, offLabel: { en: "a", fr: "b" } })).toBe("label");
  });
  test("every enforced flag is a real feature", () => {
    for (const f of FEATURE_FLAGS) expect(FEATURE_KEYS).toContain(f);
  });
});

describe("the free trial is Pro only", () => {
  test("Pro → Business gains exactly the Business-only features", () => {
    expect(gainedFeatures(SEED, "pro", "business")).toEqual(
      expect.arrayContaining(["discountCodes", "teamRoles", "orderTracking", "salesReports", "customDomain", "stockManagement"]),
    );
    expect(gainedFeatures(SEED, "pro", "business")).not.toContain("salesPromotions");
    expect(gainedFeatures(SEED, "business", "pro")).toEqual([]);
  });
  test("the trial plan's limits never include a Business-only flag", () => {
    const trial = resolvePlanLimits(SEED, "pro").features as readonly string[];
    for (const key of gainedFeatures(SEED, "pro", "business")) expect(trial).not.toContain(key);
  });
  test("only the trial plan can have trial months", () => {
    expect(planSettingsProblem("business", { ...SEED.plans.business, trialMonths: 2 })).toBe("trialMonths");
    expect(planSettingsProblem("enterprise", { ...SEED.plans.enterprise, trialMonths: 1 })).toBe("trialMonths");
    expect(planSettingsProblem("pro", SEED.plans.pro)).toBeNull();
  });
});
