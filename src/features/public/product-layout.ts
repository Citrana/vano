import type { ProductLayout } from "../../../convex/lib/looks/sections"

/**
 * Grid classes for a product list (CLAUDE.md "Shop looks"): the seller's
 * layout, readable on phones (2 columns at most, 1 for big cards). Cards
 * keep their normal size and stay left-aligned whatever the number of
 * products. "phone" forces the phone layout (previews). Class strings
 * stay literal for Tailwind.
 */
export type GridColumns = "responsive" | "phone"

export function productListClasses(layout: ProductLayout, columns: GridColumns): { list: string; size: "default" | "large" } {
  const phone = columns === "phone"
  if (layout === "large") {
    return { list: phone ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6", size: "large" }
  }
  if (layout === "grid3") {
    return { list: phone ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4", size: "default" }
  }
  // The default: 2 columns on phones, 3 on tablets, 4 on computers (smaller cards).
  return { list: phone ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4", size: "default" }
}
