import { describe, expect, test } from "vitest"
import type { StoredLook } from "../../../../convex/lib/looks/validators"
import { facetChanged, parseSection, presetChanged, previewProducts } from "./section-state"

const KEYS = ["looks", "colors", "banner"] as const

describe("parseSection", () => {
  test("URL value, then the remembered one, then the first", () => {
    expect(parseSection("colors", KEYS)).toBe("colors")
    expect(parseSection("nope", KEYS, "banner")).toBe("banner")
    expect(parseSection(null, KEYS, "nope")).toBe("looks")
    expect(parseSection(undefined, KEYS)).toBe("looks")
  })
})

describe("changed", () => {
  const live: StoredLook = { v: 1, preset: "blush", overrides: { colors: { accent: "#b83260", background: "#fff1f3" } } }
  test("per facet, key order ignored", () => {
    const draft: StoredLook = { v: 1, preset: "blush", overrides: { colors: { background: "#fff1f3", accent: "#b83260" } } }
    expect(facetChanged("colors")(draft, live)).toBe(false)
    expect(facetChanged("buttons")(draft, live)).toBe(false)
    const edited: StoredLook = { ...draft, overrides: { ...draft.overrides, buttons: { shape: "pill", fill: "solid", weight: "bold" } } }
    expect(facetChanged("buttons")(edited, live)).toBe(true)
    expect(facetChanged("colors")(edited, live)).toBe(false)
    expect(presetChanged({ ...draft, preset: "noir" }, live)).toBe(true)
  })
})

describe("previewProducts", () => {
  test("own products when 2+, samples top up to 4 otherwise", () => {
    expect(previewProducts([1, 2, 3, 4, 5], [9])).toEqual({ products: [1, 2, 3, 4], sample: false })
    expect(previewProducts([1, 2], [9])).toEqual({ products: [1, 2], sample: false })
    expect(previewProducts([1], [7, 8, 9, 10])).toEqual({ products: [1, 7, 8, 9], sample: true })
    expect(previewProducts([], [7, 8, 9, 10, 11])).toEqual({ products: [7, 8, 9, 10], sample: true })
  })
})
