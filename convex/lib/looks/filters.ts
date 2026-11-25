import type { FilterMode } from "./sections";

/**
 * Which customer filters a shop page offers (CLAUDE.md "Shop looks"). The
 * one rule: the public query computes it on the server (with the
 * `shopFilters` plan feature) and the page, the demo and the look preview
 * draw from it. Pure.
 *
 * - "off": no filter row at all.
 * - Full filters: the seller chose "on", or "auto" with at least
 *   FULL_FILTERS_MIN_PRODUCTS visible products.
 * - Category chips: full filters, on every plan.
 * - The Sale chip and the "Filters" panel (search, price, size, colour,
 *   On sale, New): need `shopFilters` (the panel also needs full filters).
 */

/** Shops with fewer products (in "auto") only get the sort and the Sale chip. */
export const FULL_FILTERS_MIN_PRODUCTS = 8;

export type FilterAccess = {
  /** The filter row shows (sort at least). */
  show: boolean;
  categories: boolean;
  sale: boolean;
  /** The "Filters" button and its panel. */
  panel: boolean;
};

export const NO_FILTER_ACCESS: FilterAccess = { show: false, categories: false, sale: false, panel: false };
export const FULL_FILTER_ACCESS: FilterAccess = { show: true, categories: true, sale: true, panel: true };

export function filterAccess({
  mode,
  entitled,
  productCount,
}: {
  mode: FilterMode | undefined;
  entitled: boolean;
  productCount: number;
}): FilterAccess {
  if (mode === "off") return NO_FILTER_ACCESS;
  const full = mode === "on" || productCount >= FULL_FILTERS_MIN_PRODUCTS;
  return { show: true, categories: full, sale: entitled, panel: full && entitled };
}
