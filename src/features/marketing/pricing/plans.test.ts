import { describe, expect, test } from "vitest"
import { catalogOf, type PlanCatalog } from "../../../../convex/lib/planCatalog"
import { DEFAULT_PLAN_CONFIG } from "../../../../convex/lib/planDefaults"
import { withFeatureValue } from "../../../../convex/lib/planFeatures"
import { buildComparison, buildPlanCards, formatPlanPrice, startingPriceMinor, visiblePlans } from "./plans"

const SEED = catalogOf(DEFAULT_PLAN_CONFIG)
const everything = (plan: string) => `Everything in ${plan}`
const cards = (catalog: PlanCatalog = SEED) => buildPlanCards(catalog, "en", everything)
const labels = (id: string, catalog?: PlanCatalog) => cards(catalog).find((p) => p.id === id)!.features.map((f) => f.label)
const rows = (catalog: PlanCatalog = SEED) => buildComparison(catalog, "en").flatMap((g) => g.rows)
const row = (key: string, catalog?: PlanCatalog) => rows(catalog).find((r) => r.key === key)!

describe("plan cards from the catalogue (seed = the pricing page as it was)", () => {
  test("Free lists what it includes, with the free look line", () => {
    expect(labels("free")).toEqual([
      "Up to 10 products",
      "Up to 3 photos per product",
      "Your Vano link",
      "WhatsApp orders",
      "1 basic shop look",
    ])
  })
  test("Pro adds to Free (no 'Everything in Free'), leading with sales", () => {
    const pro = cards().find((p) => p.id === "pro")!
    expect(pro.features[0]).toMatchObject({ key: "salesPromotions", hint: expect.stringContaining("Event banners") })
    expect(labels("pro")).toEqual([
      "Run sales and special offers on your shop",
      "Up to 50 products",
      "Up to 6 photos per product",
      "All shop looks, colors, profile photo styles, and banner",
      "Categories, sizes, and colors",
      "Shop stats (views, WhatsApp clicks, best-viewed products)",
      "Priority support",
    ])
  })
  test("Business and Enterprise say 'Everything in …' then what they add", () => {
    expect(labels("business")).toEqual([
      "Everything in Pro",
      "Unlimited products",
      "Discount codes for customers",
      "Team accounts with roles",
      "Order tracking (new, confirmed, delivered)",
      "Sales tracking and monthly reports",
    ])
    expect(labels("enterprise")).toEqual([
      "Everything in Business",
      "Several shops or branches in one account",
      "Personalized setup and onboarding",
      "A dedicated contact person",
      "Custom integrations (payments, delivery)",
      "Service guarantees",
    ])
  })
  test("prices, CTAs, highlight and the yearly note", () => {
    expect(cards().map((p) => [p.id, p.priceMinor, p.cta, p.highlight, p.yearlyFreeMonths])).toEqual([
      ["free", 0, "free", false, null],
      ["pro", 29900, "trial", true, 2],
      ["business", 100000, "trial", false, null],
      ["enterprise", null, "talk", false, null],
    ])
  })
  test("names and lines follow the language", () => {
    const fr = buildPlanCards(SEED, "fr", (plan) => `Tout ce qu'inclut ${plan}`)
    expect(fr[0]).toMatchObject({ name: "Gratuit" })
    expect(fr[0].features[0].label).toBe("Jusqu'à 10 produits")
    expect(fr[3].features[0].label).toBe("Tout ce qu'inclut Business")
  })
})

describe("admin changes show up on the pricing page", () => {
  test("a hidden plan is left out of the cards, the table and the starting price", () => {
    const hidden = catalogOf({
      ...DEFAULT_PLAN_CONFIG,
      plans: { ...DEFAULT_PLAN_CONFIG.plans, pro: { ...DEFAULT_PLAN_CONFIG.plans.pro, visible: false } },
    })
    expect(visiblePlans(hidden).map((p) => p.id)).toEqual(["free", "business", "enterprise"])
    expect(cards(hidden).map((p) => p.id)).toEqual(["free", "business", "enterprise"])
    expect(Object.keys(row("products", hidden).cells)).toEqual(["free", "business", "enterprise"])
    expect(startingPriceMinor(hidden)).toBe(100000)
    // Business now follows Free: no "Everything in", it lists its own additions.
    expect(labels("business", hidden)[0]).toBe("Run sales and special offers on your shop")
  })
  test("a new limit and a feature moved to another plan", () => {
    const changed = catalogOf(
      withFeatureValue(withFeatureValue(DEFAULT_PLAN_CONFIG, "products", "free", 15), "shopStats", "free", true),
    )
    expect(labels("free", changed)).toContain("Up to 15 products")
    expect(labels("free", changed)).toContain("Shop stats (views, WhatsApp clicks, best-viewed products)")
    expect(labels("pro", changed)).not.toContain("Shop stats (views, WhatsApp clicks, best-viewed products)")
    expect(row("shopStats", changed).cells.free).toBe(true)
  })
})

describe("comparison table", () => {
  test("grouped by area; limits as counts or unlimited; inherited values shown", () => {
    expect(buildComparison(SEED, "en").map((g) => g.key)).toEqual(["products", "shopLook", "sales", "team", "support"])
    expect(row("products").cells).toEqual({ free: { count: 10 }, pro: { count: 50 }, business: { label: "unlimited" }, enterprise: { label: "unlimited" } })
    expect(row("photosPerProduct").cells).toEqual({ free: { count: 3 }, pro: { count: 6 }, business: { count: 6 }, enterprise: { count: 6 } })
    expect(row("customDomain").cells).toEqual({ free: false, pro: false, business: true, enterprise: true })
  })
  test("row keys are unique and hidden rows stay out", () => {
    const keys = rows().map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).not.toContain("teamMembers")
  })
  test("no 'Made with Vano' feature anywhere", () => {
    for (const k of rows().map((r) => r.key)) expect(k).not.toMatch(/madeWith|badge/i)
  })
})

describe("prices", () => {
  test("starting price is the cheapest paid visible plan", () => {
    expect(startingPriceMinor(SEED)).toBe(29900)
  })
  test("formats shillings per language", () => {
    expect(formatPlanPrice(29900, "en")).toMatch(/^Ksh\s299$/)
    expect(formatPlanPrice(100000, "en")).toMatch(/^Ksh\s1,000$/)
    expect(formatPlanPrice(29900, "fr")).toMatch(/^299\sKES$/)
  })
})
