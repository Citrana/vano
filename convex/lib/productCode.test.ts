import { describe, expect, test } from "vitest";
import { CODE_PREFIX, normalizeProductCode, productCodeProblem, suggestProductCode } from "./productCode";

describe("product codes", () => {
  test("are normalised: trimmed, upper case, spaces as dashes", () => {
    expect(normalizeProductCode("  clo 12 ")).toBe("CLO-12");
    expect(normalizeProductCode("sho-001")).toBe("SHO-001");
  });

  test("2 to 16 letters, digits or single dashes", () => {
    expect(productCodeProblem("CLO-001")).toBeNull();
    expect(productCodeProblem("A1")).toBeNull();
    expect(productCodeProblem("A")).toBe("length");
    expect(productCodeProblem("A".repeat(17))).toBe("length");
    expect(productCodeProblem("CLO_1")).toBe("chars");
    expect(productCodeProblem("-CLO")).toBe("chars");
    expect(productCodeProblem("CLO--1")).toBe("chars");
    expect(productCodeProblem("ÉTÉ-1")).toBe("chars");
  });

  test("suggestions use the category prefix and the next running number", () => {
    expect(suggestProductCode("clothes", [])).toBe("CLO-001");
    expect(suggestProductCode("clothes", ["CLO-001", "clo-007", "SHO-020", "VIP"])).toBe("CLO-008");
    expect(suggestProductCode("shoes", ["CLO-001", "SHO-020"])).toBe("SHO-021");
    expect(suggestProductCode("bags", ["BAG-999"])).toBe("BAG-1000");
    for (const prefix of Object.values(CODE_PREFIX)) expect(productCodeProblem(`${prefix}-001`)).toBeNull();
  });
});
