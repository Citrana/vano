import { describe, expect, test } from "vitest"
import { PLANS, STARTING_PRICE_MINOR, formatPlanPrice } from "./plans"

describe("plans config", () => {
  test("ids are unique and exactly one plan is highlighted", () => {
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(PLANS.length)
    expect(PLANS.filter((p) => p.highlight)).toHaveLength(1)
  })
  test("prices are whole minor units; only custom plans have no price", () => {
    for (const p of PLANS) {
      if (p.priceMinor === null) expect(p.cta).toBe("whatsapp")
      else expect(Number.isSafeInteger(p.priceMinor) && p.priceMinor >= 0).toBe(true)
    }
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
