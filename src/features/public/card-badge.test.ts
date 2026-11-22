import { describe, expect, it } from "vitest"
import { isNewProduct, NEW_BADGE_DAYS } from "../../../convex/lib/looks/sections"
import { cardBadge } from "./card-badge"

const base = { soldOut: false, sale: null, isNew: false, highlight: null, fewLeft: false }
const sale = { percent: 30, badge: true, label: true }

describe("cardBadge", () => {
  it("shows one badge: Sold out first, then the sale", () => {
    expect(cardBadge({ ...base, soldOut: true, sale, isNew: true, fewLeft: true })).toEqual({ kind: "soldOut" })
    expect(cardBadge({ ...base, sale, isNew: true, highlight: "Back", fewLeft: true })).toEqual({ kind: "salePercent", percent: 30 })
  })

  it("uses the Sale label when the seller hid the percent badge", () => {
    expect(cardBadge({ ...base, sale: { ...sale, badge: false } })).toEqual({ kind: "saleLabel" })
    expect(cardBadge({ ...base, sale: { ...sale, badge: false, label: false }, isNew: true })).toEqual({ kind: "new" })
  })

  it("then New, the section label, Few left, or nothing", () => {
    expect(cardBadge({ ...base, isNew: true, highlight: "Back", fewLeft: true })).toEqual({ kind: "new" })
    expect(cardBadge({ ...base, highlight: "Back", fewLeft: true })).toEqual({ kind: "highlight", label: "Back" })
    expect(cardBadge({ ...base, fewLeft: true })).toEqual({ kind: "fewLeft" })
    expect(cardBadge(base)).toBeNull()
  })
})

describe("New badge", () => {
  it("lasts 14 days", () => {
    const day = 86_400_000
    expect(NEW_BADGE_DAYS).toBe(14)
    expect(isNewProduct(0, 13 * day)).toBe(true)
    expect(isNewProduct(0, 14 * day)).toBe(false)
  })
})
