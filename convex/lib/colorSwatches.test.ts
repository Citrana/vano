import { describe, expect, test } from "vitest";
import { colorSwatch } from "./colorSwatches";
import { isNewProduct, NEW_BADGE_DAYS } from "./looks/sections";

describe("colorSwatch", () => {
  test("common EN / FR names, any case and spacing", () => {
    expect(colorSwatch("Black")).toBe(colorSwatch("noir"));
    expect(colorSwatch("  Bleu   Marine ")).toBe(colorSwatch("navy"));
    expect(colorSwatch("ROSE")).not.toBeNull();
  });
  test("other names stay text (null)", () => {
    expect(colorSwatch("wax print")).toBeNull();
    expect(colorSwatch("")).toBeNull();
  });
});

describe("isNewProduct", () => {
  test("new for NEW_BADGE_DAYS after it was added", () => {
    const day = 86_400_000;
    expect(isNewProduct(0, 0)).toBe(true);
    expect(isNewProduct(0, NEW_BADGE_DAYS * day - 1)).toBe(true);
    expect(isNewProduct(0, NEW_BADGE_DAYS * day)).toBe(false);
    expect(isNewProduct(10, 0)).toBe(false);
  });
});
