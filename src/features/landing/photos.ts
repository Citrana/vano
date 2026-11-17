import type { Currency } from "../../../convex/lib/money"

/**
 * Sample products for the hero mockup and the demo grid. Photos are free
 * Unsplash images (unsplash.com/license), resized to 640×800 WebP in
 * /public/landing. Source ids: red-dress 1595777457583, red-bag
 * 1584917865442, floral-heels 1543163521, bomber-jacket 1591047139829,
 * knit-poncho 1434389677669, yellow-set 1515886657613.
 */
export type SampleProduct = {
  key: "productDress" | "productBag" | "productHeels" | "productJacket" | "productPoncho" | "productSet"
  src: string
  /** Minor units (CLAUDE.md "Money"). */
  price: number
}

export const SAMPLE_CURRENCY: Currency = "USD"

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  { key: "productDress", src: "/landing/red-dress.webp", price: 4500 },
  { key: "productBag", src: "/landing/red-bag.webp", price: 3800 },
  { key: "productHeels", src: "/landing/floral-heels.webp", price: 2900 },
  { key: "productJacket", src: "/landing/bomber-jacket.webp", price: 3500 },
  { key: "productPoncho", src: "/landing/knit-poncho.webp", price: 2200 },
  { key: "productSet", src: "/landing/yellow-set.webp", price: 4000 },
]
