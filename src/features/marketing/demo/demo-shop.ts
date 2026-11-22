import type { StaticImageData } from "next/image"
import type { Category } from "../../../../convex/lib/catalog"
import type { Currency } from "../../../../convex/lib/money"
import { DEFAULT_SECTIONS, type SectionsFacet } from "../../../../convex/lib/looks/sections"
import blueHeels from "@/assets/images/photos/products/demo/blue-heels.webp"
import kenteCropTop2 from "@/assets/images/photos/products/demo/kente-crop-top-2.webp"
import kenteCropTop from "@/assets/images/photos/products/demo/kente-crop-top.webp"
import kenteShirt from "@/assets/images/photos/products/demo/kente-shirt.webp"
import leatherBoots from "@/assets/images/photos/products/demo/leather-jacket.webp"
import printedTop from "@/assets/images/photos/products/demo/printed-top.webp"
import slipDress2 from "@/assets/images/photos/products/demo/slip-dress-2.webp"
import slipDress from "@/assets/images/photos/products/demo/slip-dress.webp"
import waxPrintShirt from "@/assets/images/photos/products/demo/wax-print-shirt.webp"
import whiteSunglasses from "@/assets/images/photos/products/demo/white-sunglasses.webp"
import wideBrimHat2 from "@/assets/images/photos/products/demo/wide-brim-hat-2.webp"
import wideBrimHat from "@/assets/images/photos/products/demo/wide-brim-hat.webp"

/**
 * The built-in demo shop (/demo and the Home phone). Static sample data,
 * no Convex, no stats. Names and descriptions live in messages under
 * `Demo.products.<id>`; no city or country on purpose.
 */
export const DEMO_SLUG = "demo"
export const DEMO_CURRENCY: Currency = "KES"

export const DEMO_PRODUCT_IDS = [
  "slip-dress",
  "kente-shirt",
  "printed-top",
  "blue-heels",
  "wax-print-shirt",
  "wide-brim-hat",
  "kente-crop-top",
  "leather-boots",
  "white-sunglasses",
] as const
export type DemoProductId = (typeof DEMO_PRODUCT_IDS)[number]

export type DemoProduct = {
  /** Also the message key under `Demo.products`. */
  id: DemoProductId
  category: Category
  /** Minor units (CLAUDE.md "Money"). */
  price: number
  sizes: string[]
  colors: string[]
  soldOut?: boolean
  /** Section and label flags (CLAUDE.md "Shop looks"), so visitors see what sellers get. */
  featured?: boolean
  fewLeft?: boolean
  backInStock?: boolean
  photos: StaticImageData[]
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  { id: "slip-dress", category: "clothes", price: 250000, sizes: ["S", "M", "L"], colors: [], featured: true, photos: [slipDress, slipDress2] },
  { id: "kente-shirt", category: "clothes", price: 320000, sizes: ["M", "L", "XL"], colors: [], photos: [kenteShirt] },
  { id: "printed-top", category: "clothes", price: 180000, sizes: ["S", "M", "L"], colors: [], photos: [printedTop] },
  { id: "blue-heels", category: "shoes", price: 290000, sizes: ["37", "38", "39", "40"], colors: [], featured: true, fewLeft: true, photos: [blueHeels] },
  { id: "wax-print-shirt", category: "clothes", price: 220000, sizes: ["M", "L", "XL"], colors: [], photos: [waxPrintShirt] },
  { id: "wide-brim-hat", category: "accessories", price: 150000, sizes: [], colors: [], featured: true, photos: [wideBrimHat, wideBrimHat2] },
  { id: "kente-crop-top", category: "clothes", price: 160000, sizes: ["S", "M", "L", "XL"], colors: [], photos: [kenteCropTop, kenteCropTop2] },
  { id: "leather-boots", category: "shoes", price: 450000, sizes: ["41", "42", "43", "44"], colors: [], soldOut: true, photos: [leatherBoots] },
  { id: "white-sunglasses", category: "accessories", price: 90000, sizes: [], colors: [], backInStock: true, photos: [whiteSunglasses] },
]

/** The demo shop's sections: a "Featured" row above every product. */
export const DEMO_SECTIONS: SectionsFacet = {
  ...DEFAULT_SECTIONS,
  order: DEFAULT_SECTIONS.order.map((entry) => (entry.id === "featured" ? { ...entry, on: true } : entry)),
}

export function demoProduct(id: string): DemoProduct | null {
  return DEMO_PRODUCTS.find((p) => p.id === id) ?? null
}
