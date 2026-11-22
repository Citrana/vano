import { describe, expect, test } from "vitest"
import type { StoredLook } from "../../../../convex/lib/looks/validators"
import { DEFAULT_SECTIONS } from "../../../../convex/lib/looks/sections"
import { facetChanged, moveItem, parseSection, presetChanged, previewProducts } from "./section-state"

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

describe("sections and announcement bar", () => {
  const base: StoredLook = { v: 1, preset: "classic", overrides: {} }

  test("changed when the sections or the announcement bar differ", () => {
    const withSections: StoredLook = { ...base, overrides: { sections: { ...DEFAULT_SECTIONS, layout: "large" } } }
    expect(facetChanged("sections")(withSections, base)).toBe(true)
    expect(facetChanged("sections")(withSections, withSections)).toBe(false)
    expect(facetChanged("announcement")({ ...base, overrides: { announcement: { text: "Hi", tone: "dark" } } }, base)).toBe(true)
  })

  test("preview products go up to the asked maximum", () => {
    expect(previewProducts([1, 2, 3, 4, 5, 6], [9], 12)).toEqual({ products: [1, 2, 3, 4, 5, 6], sample: false })
  })
})

describe("moveItem", () => {
  test("moves one item, clamped to the list", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"])
    expect(moveItem(["a", "b", "c"], 1, 9)).toEqual(["a", "c", "b"])
    expect(moveItem(["a", "b", "c"], 5, 0)).toEqual(["a", "b", "c"])
  })
})
