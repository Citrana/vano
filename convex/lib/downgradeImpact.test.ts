import { describe, expect, test } from "vitest";
import { downgradeImpactOf, hasImpact, type DowngradeInput } from "./downgradeImpact";
import { FREE_LOOK, presetLook } from "./looks/presets";
import { DEFAULT_PLAN_CONFIG } from "./planDefaults";
import { resolvePlanLimits } from "./planFeatures";

const limits = (plan: "free" | "pro" | "business") => resolvePlanLimits(DEFAULT_PLAN_CONFIG, plan);
const base = (over: Partial<DowngradeInput> = {}): DowngradeInput => ({
  current: limits("business"),
  target: limits("pro"),
  liveSales: 0,
  liveCodes: 0,
  visibleProducts: 0,
  published: null,
  ...over,
});

describe("downgradeImpactOf", () => {
  test("Business → Pro: discount codes stop, sales keep running, products over 50 hidden", () => {
    const impact = downgradeImpactOf(base({ liveSales: 2, liveCodes: 3, visibleProducts: 60 }));
    expect(impact).toMatchObject({ sales: 0, discountCodes: 3, productsHidden: 10, look: false });
    expect(hasImpact(impact)).toBe(true);
  });

  test("Pro → Free: sales stop, products over 10 hidden, a custom look goes back to Classic", () => {
    const custom = presetLook("noir");
    const impact = downgradeImpactOf(
      base({ current: limits("pro"), target: limits("free"), liveSales: 1, visibleProducts: 12, published: custom }),
    );
    expect(impact).toMatchObject({ sales: 1, discountCodes: 0, productsHidden: 2, look: true });
  });

  test("the free look, no sales and few products: nothing pauses", () => {
    const impact = downgradeImpactOf(base({ current: limits("pro"), target: limits("free"), visibleProducts: 4, published: FREE_LOOK }));
    expect(hasImpact(impact)).toBe(false);
  });

  test("a feature the target keeps never pauses", () => {
    expect(downgradeImpactOf(base({ current: limits("pro"), target: limits("pro"), liveSales: 5 })).sales).toBe(0);
  });
});
