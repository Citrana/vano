import { describe, expect, it } from "vitest"
import {
  applyShopFilters,
  filterOptions,
  filtersActive,
  isFiltering,
  NO_FILTERS,
  panelFilterCount,
  parseShopFilters,
  shopFiltersToQuery,
  type FilterableProduct,
} from "./shop-filters"

const products: FilterableProduct[] = [
  { _id: "a", name: "Robe Été wax", price: 5000, category: "clothes", sizes: ["S", "M"], colors: ["Rouge"] },
  { _id: "b", name: "Sandales cuir", price: 3000, category: "shoes", sizes: ["38", "39"], colors: ["Noir"], sale: { price: 2000 } },
  { _id: "c", name: "Sac en raphia", price: 8000, category: "bags", colors: ["rouge", "Beige"] },
  { _id: "d", name: "Robe longue", price: 12000, category: "clothes", sizes: ["m", "L"], colors: [] },
]
const full = { full: true, sale: true }
const ids = (list: FilterableProduct[]) => list.map((p) => p._id)

describe("shop filter links", () => {
  it("round-trips every filter, leaving defaults out", () => {
    const filters = {
      q: "robe",
      category: "clothes" as const,
      sale: true,
      sort: "priceAsc" as const,
      sizes: ["M", "L"],
      colors: ["Rouge"],
      min: 2050,
      max: 10000,
    }
    const query = shopFiltersToQuery(filters)
    expect(query).toBe("?q=robe&cat=clothes&sale=1&sort=priceAsc&size=M&size=L&color=Rouge&min=20.50&max=100")
    expect(parseShopFilters(new URLSearchParams(query))).toEqual(filters)
    expect(shopFiltersToQuery(NO_FILTERS)).toBe("")
    expect(isFiltering(NO_FILTERS)).toBe(false)
  })

  it("ignores invalid values and reads server search params", () => {
    expect(parseShopFilters({ cat: "cars", sort: "random", min: "abc", max: "-3", sale: "yes" })).toEqual(NO_FILTERS)
    expect(parseShopFilters({ size: ["S", "S", ""], min: "50", max: "10" })).toMatchObject({ sizes: ["S"], min: 5000, max: null })
    expect(parseShopFilters({ q: "x".repeat(200) }).q).toHaveLength(60)
  })

  it("is active only for filters the shop offers", () => {
    expect(filtersActive({ ...NO_FILTERS, sort: "priceAsc" }, { full: false, sale: false })).toBe(true)
    expect(filtersActive({ ...NO_FILTERS, q: "robe", sizes: ["S"] }, { full: false, sale: true })).toBe(false)
    expect(filtersActive({ ...NO_FILTERS, sale: true }, { full: false, sale: true })).toBe(true)
    expect(filtersActive({ ...NO_FILTERS, sale: true }, { full: true, sale: false })).toBe(false)
    expect(filtersActive({ ...NO_FILTERS, category: "bags" }, { full: true, sale: false })).toBe(true)
  })

  it("counts panel filters", () => {
    expect(panelFilterCount({ ...NO_FILTERS, sizes: ["S"], colors: ["Rouge", "Noir"], max: 100 })).toBe(4)
  })
})

describe("applyShopFilters", () => {
  it("searches names without case or accents, every word", () => {
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, q: "robe ete" }, full))).toEqual(["a"])
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, q: "ROBE" }, full))).toEqual(["a", "d"])
  })

  it("filters by category, sale, size, colour and the price paid now", () => {
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, category: "clothes" }, full))).toEqual(["a", "d"])
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, sale: true }, full))).toEqual(["b"])
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, sizes: ["M"] }, full))).toEqual(["a", "d"])
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, colors: ["Rouge"] }, full))).toEqual(["a", "c"])
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, max: 2500 }, full))).toEqual(["b"])
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, min: 6000, max: 9000 }, full))).toEqual(["c"])
  })

  it("sorts by price (sale price) or keeps the newest-first order", () => {
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, sort: "priceAsc" }, full))).toEqual(["b", "a", "c", "d"])
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, sort: "priceDesc" }, full))).toEqual(["d", "c", "a", "b"])
    expect(ids(applyShopFilters(products, NO_FILTERS, full))).toEqual(["a", "b", "c", "d"])
  })

  it("ignores filters the shop doesn't offer", () => {
    const small = { full: false, sale: true }
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, q: "robe", category: "bags", max: 1 }, small))).toHaveLength(4)
    expect(ids(applyShopFilters(products, { ...NO_FILTERS, sale: true }, { full: true, sale: false }))).toHaveLength(4)
  })
})

describe("filterOptions", () => {
  it("lists categories, distinct sizes and colours, price bounds", () => {
    const options = filterOptions(products)
    expect(options).toMatchObject({
      full: false,
      sale: true,
      categories: ["clothes", "shoes", "bags"],
      sizes: ["S", "M", "38", "39", "L"],
      colors: ["Rouge", "Noir", "Beige"],
      minPrice: 2000,
      maxPrice: 12000,
    })
    expect(filterOptions([...products, ...products]).full).toBe(true)
  })
})
