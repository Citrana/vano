import { CATEGORY_KEYS, type Category } from "../../../../convex/lib/catalog"
import { minorToInput, parseMoneyToMinor } from "../../../../convex/lib/money"

/**
 * The shop page's search, filters and sort (CLAUDE.md "Public pages").
 * Pure: the page parses the link on the server (a shared filtered link
 * renders filtered), the filter bar writes it back. Prices in the link
 * are major units ("min=20"), read and written with the money helpers.
 */

export const SHOP_SORTS = ["newest", "priceAsc", "priceDesc"] as const
export type ShopSort = (typeof SHOP_SORTS)[number]

/** Shops with fewer products only get the Sale chip and the sort. */
export const FULL_FILTERS_MIN_PRODUCTS = 8
export const SEARCH_MAX = 60

export type ShopFilters = {
  q: string
  category: Category | null
  sale: boolean
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

/** How many filters are set inside the "Filters" panel (size, colour, price). */
export function panelFilterCount(filters: ShopFilters): number {
  return filters.sizes.length + filters.colors.length + (filters.min !== null || filters.max !== null ? 1 : 0)
}

/** What this shop offers: the full filters (enough products) and the Sale chip (a sale runs). */
export type AvailableFilters = { full: boolean; sale: boolean }

/** Whether the filters change the list for this shop (filters it doesn't offer are ignored). */
export function filtersActive(filters: ShopFilters, available: AvailableFilters): boolean {
  if (filters.sort !== "newest") return true
  if (available.sale && filters.sale) return true
  return available.full && (filters.q.trim() !== "" || filters.category !== null || panelFilterCount(filters) > 0)
}

/** Lower case, accents removed: "Robe Été" matches "robe ete". */
export function searchKey(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

const sameText = (a: string, b: string) => searchKey(a) === searchKey(b)

/** The price a buyer pays now: the sale price while on sale. */
export const shownPrice = (p: FilterableProduct) => p.sale?.price ?? p.price

/**
 * The products matching the filters, sorted. "newest" keeps the given
 * order (the page's products are newest first). Filters that don't
 * apply to this shop (`available`) are ignored, e.g. the panel on a
 * small shop or the Sale chip after a sale ended.
 */
export function applyShopFilters<P extends FilterableProduct>(
  products: readonly P[],
  filters: ShopFilters,
  available: AvailableFilters,
): P[] {
  const words = searchKey(filters.q).split(/\s+/).filter(Boolean)
  const full = available.full
  const result = products.filter((p) => {
    if (full && words.length > 0) {
      const name = searchKey(p.name)
      if (!words.every((word) => name.includes(word))) return false
    }
    if (full && filters.category && p.category !== filters.category) return false
    if (available.sale && filters.sale && !p.sale) return false
    if (full && filters.sizes.length > 0 && !filters.sizes.some((s) => (p.sizes ?? []).some((size) => sameText(size, s)))) return false
    if (full && filters.colors.length > 0 && !filters.colors.some((c) => (p.colors ?? []).some((color) => sameText(color, c)))) return false
    const price = shownPrice(p)
    if (full && filters.min !== null && price < filters.min) return false
    if (full && filters.max !== null && price > filters.max) return false
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

/** What the filter bar offers for these products. */
export function filterOptions(products: readonly FilterableProduct[]) {
  const prices = products.map(shownPrice)
  return {
    full: products.length >= FULL_FILTERS_MIN_PRODUCTS,
    sale: products.some((p) => p.sale),
    categories: CATEGORY_KEYS.filter((key) => products.some((p) => p.category === key)),
    sizes: distinct(products.flatMap((p) => p.sizes ?? [])),
    colors: distinct(products.flatMap((p) => p.colors ?? [])),
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
  }
}

export type FilterOptions = ReturnType<typeof filterOptions>
