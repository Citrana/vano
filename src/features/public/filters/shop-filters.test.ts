import { describe, expect, it } from "vitest"
import { FULL_FILTER_ACCESS, NO_FILTER_ACCESS, type FilterAccess } from "../../../../convex/lib/looks/filters"
import {
  activeFilterChips,
  applyShopFilters,
  filterOptions,
  isFiltering,
  limitShopFilters,
  nicePrice,
  NO_FILTERS,
  panelFilterCount,
  parseShopFilters,
  priceRanges,
  shopFiltersToQuery,
  type FilterableProduct,
  type ShopFilters,
} from "./shop-filters"

const products: FilterableProduct[] = [
  { _id: "a", name: "Robe Été wax", price: 5000, category: "clothes", sizes: ["S", "M"], colors: ["Rouge"], isNew: true, condition: "thrift", audience: "women" },
  { _id: "b", name: "Sandales cuir", price: 3000, category: "shoes", sizes: ["38", "39"], colors: ["Noir"], sale: { price: 2000 }, condition: "new", audience: "men" },
  { _id: "c", name: "Sac en raphia", price: 8000, category: "bags", colors: ["rouge", "Beige"], audience: "women" },
  { _id: "d", name: "Robe longue", price: 12000, category: "clothes", sizes: ["m", "L"], colors: [] },
]
const ids = (list: FilterableProduct[]) => list.map((p) => p._id)
const apply = (filters: Partial<ShopFilters>) => ids(applyShopFilters(products, { ...NO_FILTERS, ...filters }))
const options = filterOptions(products)

describe("shop filter links", () => {
  it("round-trips every filter, leaving defaults out", () => {
    const filters: ShopFilters = {
      q: "robe",
      category: "clothes",
      sale: true,
      isNew: true,
      sort: "priceAsc",
      sizes: ["M", "L"],
      colors: ["Rouge"],
      conditions: ["thrift"],
      audiences: ["women", "kids"],
      min: 2050,
      max: 10000,
    }
    const query = shopFiltersToQuery(filters)
    expect(query).toBe(
      "?q=robe&cat=clothes&sale=1&new=1&sort=priceAsc&size=M&size=L&color=Rouge&cond=thrift&for=women&for=kids&min=20.50&max=100",
    )
    expect(parseShopFilters(new URLSearchParams(query))).toEqual(filters)
    expect(shopFiltersToQuery(NO_FILTERS)).toBe("")
    expect(isFiltering(NO_FILTERS)).toBe(false)
  })

  it("ignores invalid values and reads server search params", () => {
    expect(parseShopFilters({ cat: "cars", sort: "random", min: "abc", max: "-3", sale: "yes", new: "true" })).toEqual(NO_FILTERS)
    expect(parseShopFilters({ size: ["S", "S", ""], min: "50", max: "10" })).toMatchObject({ sizes: ["S"], min: 5000, max: null })
    expect(parseShopFilters({ q: "x".repeat(200) }).q).toHaveLength(60)
  })

  it("counts panel filters for the button badge", () => {
    expect(panelFilterCount({ ...NO_FILTERS, sizes: ["S"], colors: ["Rouge", "Noir"], max: 100 })).toBe(4)
    expect(panelFilterCount({ ...NO_FILTERS, q: "robe", isNew: true, category: "bags", sale: true })).toBe(2)
  })
})

describe("limitShopFilters", () => {
  const everything: ShopFilters = { ...NO_FILTERS, q: "robe", category: "bags", sale: true, isNew: true, sort: "priceAsc", sizes: ["S"], colors: ["Rouge"], min: 1, max: 9 }

  it("keeps everything with full access", () => {
    expect(limitShopFilters(everything, FULL_FILTER_ACCESS, options)).toEqual(everything)
  })

  it("Free: category and sort only", () => {
    const free: FilterAccess = { show: true, categories: true, sale: false, panel: false }
    expect(limitShopFilters(everything, free, options)).toEqual({ ...NO_FILTERS, category: "bags", sort: "priceAsc" })
  })

  it("small shops: sort and Sale; hidden: nothing", () => {
    const small: FilterAccess = { show: true, categories: false, sale: true, panel: false }
    expect(limitShopFilters(everything, small, options)).toEqual({ ...NO_FILTERS, sale: true, sort: "priceAsc" })
    expect(limitShopFilters(everything, NO_FILTER_ACCESS, options)).toEqual(NO_FILTERS)
  })

  it("drops Sale and New when no product has them", () => {
    expect(limitShopFilters(everything, FULL_FILTER_ACCESS, { sale: false, hasNew: false })).toMatchObject({ sale: false, isNew: false })
  })
})

describe("applyShopFilters", () => {
  it("searches names without case or accents, every word", () => {
    expect(apply({ q: "robe ete" })).toEqual(["a"])
    expect(apply({ q: "ROBE" })).toEqual(["a", "d"])
  })

  it("filters by category, sale, new, size, colour and the price paid now", () => {
    expect(apply({ category: "clothes" })).toEqual(["a", "d"])
    expect(apply({ sale: true })).toEqual(["b"])
    expect(apply({ isNew: true })).toEqual(["a"])
    expect(apply({ sizes: ["M"] })).toEqual(["a", "d"])
    expect(apply({ colors: ["Rouge"] })).toEqual(["a", "c"])
    expect(apply({ max: 2500 })).toEqual(["b"])
    expect(apply({ min: 6000, max: 9000 })).toEqual(["c"])
  })

  it("sorts by price (sale price) or keeps the newest-first order", () => {
    expect(apply({ sort: "priceAsc" })).toEqual(["b", "a", "c", "d"])
    expect(apply({ sort: "priceDesc" })).toEqual(["d", "c", "a", "b"])
    expect(apply({})).toEqual(["a", "b", "c", "d"])
  })
})

describe("filterOptions", () => {
  it("lists only what exists: categories, distinct sizes and colours, price bounds", () => {
    expect(options).toMatchObject({
      sale: true,
      hasNew: true,
      categories: ["clothes", "shoes", "bags"],
      sizes: ["S", "M", "38", "39", "L"],
      colors: ["Rouge", "Noir", "Beige"],
      minPrice: 2000,
      maxPrice: 12000,
    })
    expect(filterOptions([]).priceRanges).toEqual([])
  })
})

describe("price ranges", () => {
  it("rounds cut points to nice amounts", () => {
    expect(nicePrice(50)).toBe(100)
    expect(nicePrice(3700)).toBe(3500)
    expect(nicePrice(4800)).toBe(5000)
    expect(nicePrice(2_340_000)).toBe(2_500_000)
  })

  it("builds ranges from real prices, each with products", () => {
    const ranges = priceRanges([1000, 1500, 2500, 3000, 4000, 6000, 9000])
    expect(ranges.length).toBeGreaterThanOrEqual(2)
    expect(ranges[0].min).toBeNull()
    expect(ranges[ranges.length - 1].max).toBeNull()
    // Contiguous: each range starts where the previous one ends.
    for (let i = 1; i < ranges.length; i++) expect(ranges[i].min).toBe(ranges[i - 1].max)
  })

  it("offers none when prices are too few or all alike", () => {
    expect(priceRanges([1000, 2000])).toEqual([])
    expect(priceRanges([1000, 1000, 1000, 1000])).toEqual([])
  })
})

describe("activeFilterChips", () => {
  it("one removable chip per filter, sort excluded", () => {
    const chips = activeFilterChips({ ...NO_FILTERS, q: "robe", sale: true, sort: "priceAsc", sizes: ["S", "M"], min: 1000 })
    expect(chips.map((c) => c.key)).toEqual(["q", "sale", "price", "size:S", "size:M"])
    expect(chips.find((c) => c.key === "size:S")?.patch).toEqual({ sizes: ["M"] })
    expect(chips.find((c) => c.key === "price")?.patch).toEqual({ min: null, max: null })
  })
})

describe("condition and audience filters", () => {
  it("keep products with any picked value; products without one never match", () => {
    expect(apply({ conditions: ["thrift"] })).toEqual(["a"])
    expect(apply({ conditions: ["thrift", "new"] })).toEqual(["a", "b"])
    expect(apply({ audiences: ["women"] })).toEqual(["a", "c"])
    expect(apply({ audiences: ["kids"] })).toEqual([])
    expect(apply({ audiences: ["women"], conditions: ["thrift"] })).toEqual(["a"])
  })

  it("are only offered for values the products use", () => {
    expect(options.conditions).toEqual(["new", "thrift"])
    expect(options.audiences).toEqual(["women", "men"])
    const plain = filterOptions([{ _id: "x", name: "Robe", price: 100, category: "clothes" }])
    expect(plain.conditions).toEqual([])
    expect(plain.audiences).toEqual([])
  })

  it("ignore unknown values in the link, count in the panel badge, show as chips and need the panel", () => {
    const parsed = parseShopFilters(new URLSearchParams("cond=thrift&cond=used&for=kids&for=kids"))
    expect(parsed.conditions).toEqual(["thrift"])
    expect(parsed.audiences).toEqual(["kids"])
    expect(panelFilterCount(parsed)).toBe(2)
    expect(activeFilterChips(parsed).map((c) => c.key)).toEqual(["cond:thrift", "for:kids"])
    const noPanel: FilterAccess = { ...FULL_FILTER_ACCESS, panel: false }
    const limited = limitShopFilters(parsed, noPanel, { sale: false, hasNew: false })
    expect(limited.conditions).toEqual([])
    expect(limited.audiences).toEqual([])
  })
})
