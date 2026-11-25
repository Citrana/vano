import { CATEGORY_KEYS, type Category } from "../../../../convex/lib/catalog"
import type { FilterAccess } from "../../../../convex/lib/looks/filters"
import { minorToInput, parseMoneyToMinor } from "../../../../convex/lib/money"

/**
 * The shop page's search, filters and sort (CLAUDE.md "Shop looks").
 * Pure: the page parses the link on the server (a shared filtered link
 * renders filtered) and drops what the shop doesn't offer
 * (`limitShopFilters` with the server's `FilterAccess`); the filter bar
 * writes it back. Prices in the link are major units ("min=20"), read and
 * written with the money helpers.
 */

export const SHOP_SORTS = ["newest", "priceAsc", "priceDesc"] as const
export type ShopSort = (typeof SHOP_SORTS)[number]

export const SEARCH_MAX = 60

export type ShopFilters = {
  q: string
  category: Category | null
  sale: boolean
  /** Only products with the "New" badge. */
  isNew: boolean
  sort: ShopSort
  sizes: string[]
  colors: string[]
  /** Minor units. */
  min: number | null
  max: number | null
}

export const NO_FILTERS: ShopFilters = {
  q: "",
  category: null,
  sale: false,
  isNew: false,
  sort: "newest",
  sizes: [],
  colors: [],
  min: null,
  max: null,
}

/** The fields a filter needs (a grid item has them all). */
export type FilterableProduct = {
  _id: string
  name: string
  price: number
  category: Category
  sale?: { price: number } | null
  sizes?: string[]
  colors?: string[]
  /** "New" badge, computed by the page (`isNewProduct`). */
  isNew?: boolean
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams

function all(params: Params, key: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(key)
  const value = params[key]
  return value === undefined ? [] : Array.isArray(value) ? value : [value]
}

const first = (params: Params, key: string) => all(params, key)[0] ?? ""

function money(raw: string): number | null {
  if (raw.trim() === "") return null
  return parseMoneyToMinor(raw)
}

/** The filters in a link; anything invalid is ignored. */
export function parseShopFilters(params: Params): ShopFilters {
  const cat = first(params, "cat")
  const sort = first(params, "sort")
  const min = money(first(params, "min"))
  const max = money(first(params, "max"))
  return {
    q: first(params, "q").trim().slice(0, SEARCH_MAX),
    category: (CATEGORY_KEYS as readonly string[]).includes(cat) ? (cat as Category) : null,
    sale: first(params, "sale") === "1",
    isNew: first(params, "new") === "1",
    sort: (SHOP_SORTS as readonly string[]).includes(sort) ? (sort as ShopSort) : "newest",
    sizes: [...new Set(all(params, "size").filter(Boolean))],
    colors: [...new Set(all(params, "color").filter(Boolean))],
    min,
    max: max !== null && min !== null && max < min ? null : max,
  }
}

/** The link's query string for these filters ("" = none). Defaults are left out. */
export function shopFiltersToQuery(filters: ShopFilters): string {
  const params = new URLSearchParams()
  const q = filters.q.trim()
  if (q) params.set("q", q)
  if (filters.category) params.set("cat", filters.category)
  if (filters.sale) params.set("sale", "1")
  if (filters.isNew) params.set("new", "1")
  if (filters.sort !== "newest") params.set("sort", filters.sort)
  for (const size of filters.sizes) params.append("size", size)
  for (const color of filters.colors) params.append("color", color)
  if (filters.min !== null) params.set("min", minorToInput(filters.min))
  if (filters.max !== null) params.set("max", minorToInput(filters.max))
  const query = params.toString()
  return query ? `?${query}` : ""
}

/** Anything that changes the list (search, a filter or a sort). */
export function isFiltering(filters: ShopFilters): boolean {
  return shopFiltersToQuery(filters) !== ""
}

/** How many filters are set inside the "Filters" panel (the button's badge). */
export function panelFilterCount(filters: ShopFilters): number {
  return (
    (filters.q.trim() !== "" ? 1 : 0) +
    filters.sizes.length +
    filters.colors.length +
    (filters.min !== null || filters.max !== null ? 1 : 0) +
    (filters.isNew ? 1 : 0)
  )
}

/**
 * The filters this shop offers: the server's `FilterAccess` (setting,
 * product count, plan) and what its products have now (a running sale,
 * new products). Anything else in the link is dropped, e.g. the panel on
 * a Free shop or the Sale chip after a sale ended.
 */
export function limitShopFilters(filters: ShopFilters, access: FilterAccess, options: Pick<FilterOptions, "sale" | "hasNew">): ShopFilters {
  if (!access.show) return NO_FILTERS
  const panel = access.panel
  return {
    q: panel ? filters.q : "",
    category: access.categories ? filters.category : null,
    sale: access.sale && options.sale && filters.sale,
    isNew: panel && options.hasNew && filters.isNew,
    sort: filters.sort,
    sizes: panel ? filters.sizes : [],
    colors: panel ? filters.colors : [],
    min: panel ? filters.min : null,
    max: panel ? filters.max : null,
  }
}

/** Lower case, accents removed: "Robe Été" matches "robe ete". */
export function searchKey(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

export const sameText = (a: string, b: string) => searchKey(a) === searchKey(b)

/** The price a buyer pays now: the sale price while on sale. */
export const shownPrice = (p: FilterableProduct) => p.sale?.price ?? p.price

/**
 * The products matching the filters, sorted. "newest" keeps the given
 * order (the page's products are newest first). Callers pass filters
 * already limited to what the shop offers (`limitShopFilters`).
 */
export function applyShopFilters<P extends FilterableProduct>(products: readonly P[], filters: ShopFilters): P[] {
  const words = searchKey(filters.q).split(/\s+/).filter(Boolean)
  const result = products.filter((p) => {
    if (words.length > 0) {
      const name = searchKey(p.name)
      if (!words.every((word) => name.includes(word))) return false
    }
    if (filters.category && p.category !== filters.category) return false
    if (filters.sale && !p.sale) return false
    if (filters.isNew && !p.isNew) return false
    if (filters.sizes.length > 0 && !filters.sizes.some((s) => (p.sizes ?? []).some((size) => sameText(size, s)))) return false
    if (filters.colors.length > 0 && !filters.colors.some((c) => (p.colors ?? []).some((color) => sameText(color, c)))) return false
    const price = shownPrice(p)
    if (filters.min !== null && price < filters.min) return false
    if (filters.max !== null && price > filters.max) return false
    return true
  })
  if (filters.sort === "priceAsc") return result.sort((a, b) => shownPrice(a) - shownPrice(b))
  if (filters.sort === "priceDesc") return result.sort((a, b) => shownPrice(b) - shownPrice(a))
  return result
}

/** One choice per distinct value (case and accents ignored), in first-seen order. */
function distinct(values: readonly string[]): string[] {
  const seen = new Map<string, string>()
  for (const value of values) {
    const key = searchKey(value)
    if (key && !seen.has(key)) seen.set(key, value.trim())
  }
  return [...seen.values()]
}

/** A quick price range (minor units, both ends included; null = open). */
export type PriceRange = { min: number | null; max: number | null }

/** Rounds to a "nice" amount (1, 2 or 5 × a power of ten, at least one major unit) for a range label. */
export function nicePrice(minor: number): number {
  if (minor <= 100) return 100
  const magnitude = 10 ** Math.floor(Math.log10(minor))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= minor / 4) ?? magnitude
  const unit = Math.max(100, step / 2)
  return Math.round(minor / unit) * unit
}

/**
 * Up to 4 quick price ranges from the shop's real prices: cut points at
 * the price thirds (quarters from 12 products), rounded to nice amounts.
 * Only ranges with at least one product are offered; none when every
 * product costs about the same.
 */
export function priceRanges(prices: readonly number[]): PriceRange[] {
  const sorted = [...prices].sort((a, b) => a - b)
  if (sorted.length < 3) return []
  const lo = sorted[0]
  const hi = sorted[sorted.length - 1]
  const fractions = sorted.length >= 12 ? [0.25, 0.5, 0.75] : [1 / 3, 2 / 3]
  const cuts = [...new Set(fractions.map((f) => nicePrice(sorted[Math.floor(f * (sorted.length - 1))])))].filter(
    (cut) => cut > lo && cut < hi,
  )
  if (cuts.length === 0) return []
  const ranges: PriceRange[] = [
    { min: null, max: cuts[0] },
    ...cuts.slice(1).map((cut, i) => ({ min: cuts[i], max: cut })),
    { min: cuts[cuts.length - 1], max: null },
  ]
  return ranges.filter((r) => sorted.some((p) => (r.min === null || p >= r.min) && (r.max === null || p <= r.max)))
}

export const sameRange = (r: PriceRange, filters: Pick<ShopFilters, "min" | "max">) => r.min === filters.min && r.max === filters.max

/** What the filter bar offers for these products (only values that exist). */
export function filterOptions(products: readonly FilterableProduct[]) {
  const prices = products.map(shownPrice)
  return {
    /** A sale is running on at least one product. */
    sale: products.some((p) => p.sale),
    hasNew: products.some((p) => p.isNew),
    categories: CATEGORY_KEYS.filter((key) => products.some((p) => p.category === key)),
    sizes: distinct(products.flatMap((p) => p.sizes ?? [])),
    colors: distinct(products.flatMap((p) => p.colors ?? [])),
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
    priceRanges: priceRanges(prices),
  }
}

export type FilterOptions = ReturnType<typeof filterOptions>

/** One removable chip per active filter (sort isn't one). */
export type ActiveFilterChip =
  | { key: string; kind: "q"; value: string; patch: Partial<ShopFilters> }
  | { key: string; kind: "category"; value: Category; patch: Partial<ShopFilters> }
  | { key: string; kind: "sale" | "isNew"; patch: Partial<ShopFilters> }
  | { key: string; kind: "size" | "color"; value: string; patch: Partial<ShopFilters> }
  | { key: string; kind: "price"; range: PriceRange; patch: Partial<ShopFilters> }

export function activeFilterChips(filters: ShopFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  const q = filters.q.trim()
  if (q) chips.push({ key: "q", kind: "q", value: q, patch: { q: "" } })
  if (filters.category) chips.push({ key: "cat", kind: "category", value: filters.category, patch: { category: null } })
  if (filters.sale) chips.push({ key: "sale", kind: "sale", patch: { sale: false } })
  if (filters.isNew) chips.push({ key: "new", kind: "isNew", patch: { isNew: false } })
  if (filters.min !== null || filters.max !== null) {
    chips.push({ key: "price", kind: "price", range: { min: filters.min, max: filters.max }, patch: { min: null, max: null } })
  }
  for (const size of filters.sizes) {
    chips.push({ key: `size:${size}`, kind: "size", value: size, patch: { sizes: filters.sizes.filter((s) => s !== size) } })
  }
  for (const color of filters.colors) {
    chips.push({ key: `color:${color}`, kind: "color", value: color, patch: { colors: filters.colors.filter((c) => c !== color) } })
  }
  return chips
}
