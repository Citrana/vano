import { describe, expect, test } from "vitest"
import { COMPARISON, PHOTO_LIMITS, PLANS, PRODUCT_LIMITS, STARTING_PRICE_MINOR, formatPlanPrice } from "./plans"

const rows = COMPARISON.flatMap((g) => g.rows)
const row = (key: string) => rows.find((r) => r.key === key)!

describe("plans config", () => {
  test("ids are unique and only Pro is highlighted", () => {
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(PLANS.length)
    expect(PLANS.filter((p) => p.highlight).map((p) => p.id)).toEqual(["pro"])
  })
  test("prices are whole minor units; only custom plans have no price", () => {
    for (const p of PLANS) {
      if (p.priceMinor === null) expect(p.cta).toBe("talk")
      else expect(Number.isSafeInteger(p.priceMinor) && p.priceMinor >= 0).toBe(true)
    }
  })
  test("free plan starts free, paid plans start a trial", () => {
    for (const p of PLANS) {
      if (p.priceMinor === 0) expect(p.cta).toBe("free")
      else if (p.priceMinor !== null) expect(p.cta).toBe("trial")
    }
  })
  test("each card shows 5 to 6 items, Pro leads with sales and promotions", () => {
    for (const p of PLANS) {
      expect(p.features.length).toBeGreaterThanOrEqual(5)
      expect(p.features.length).toBeLessThanOrEqual(6)
    }
    expect(PLANS.find((p) => p.id === "pro")!.features[0].key).toBe("salesPromotions")
  })
  test("comparison has a cell for every plan, row keys unique across groups", () => {
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
    for (const r of rows) expect(Object.keys(r.cells).sort()).toEqual(PLANS.map((p) => p.id).sort())
  })
  test("card and table limits agree", () => {
    for (const p of PLANS) {
      const limit = PRODUCT_LIMITS[p.id]
      expect(row("products").cells[p.id]).toEqual(limit === null ? { label: "unlimited" } : { count: limit })
      expect(row("photosPerProduct").cells[p.id]).toEqual({ count: PHOTO_LIMITS[p.id] })
      for (const f of p.features) {
        if (f.key === "products") expect(f.values).toEqual({ count: limit })
        if (f.key === "photos") expect(f.values).toEqual({ count: PHOTO_LIMITS[p.id] })
        if (f.key === "productsAndPhotos") expect(f.values).toEqual({ products: limit, photos: PHOTO_LIMITS[p.id] })
      }
    }
  })
  test("no 'Made with Vano' feature anywhere", () => {
    const keys = [...PLANS.flatMap((p) => p.features.map((f) => f.key)), ...rows.map((r) => r.key)]
    for (const k of keys) expect(k).not.toMatch(/madeWith|badge/i)
  })
  test("starting price is the cheapest paid plan", () => {
    expect(STARTING_PRICE_MINOR).toBe(29900)
  })
  test("formats shillings per language", () => {
    expect(formatPlanPrice(29900, "en")).toMatch(/^Ksh\s299$/)
    expect(formatPlanPrice(100000, "en")).toMatch(/^Ksh\s1,000$/)
    expect(formatPlanPrice(29900, "fr")).toMatch(/^299\sKES$/)
  })
})
