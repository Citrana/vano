import type { StaticImageData } from "next/image"
import type { Currency } from "../../../convex/lib/money"
import bomberJacket from "@/assets/images/photos/products/bomber-jacket.webp"
import floralHeels from "@/assets/images/photos/products/floral-heels.webp"
import knitPoncho from "@/assets/images/photos/products/knit-poncho.webp"
import redBag from "@/assets/images/photos/products/red-bag.webp"
import redDress from "@/assets/images/photos/products/red-dress.webp"
import yellowSet from "@/assets/images/photos/products/yellow-set.webp"

/**
 * Sample products for the hero mockup and the demo grid. Photos live in
 * src/assets/images/photos/products (credits in src/assets/images/README.md).
 */
export type SampleProduct = {
  key: "productDress" | "productBag" | "productHeels" | "productJacket" | "productPoncho" | "productSet"
  src: StaticImageData
  /** Minor units (CLAUDE.md "Money"). */
  price: number
}

export const SAMPLE_CURRENCY: Currency = "USD"

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  { key: "productDress", src: redDress, price: 4500 },
  { key: "productBag", src: redBag, price: 3800 },
  { key: "productHeels", src: floralHeels, price: 2900 },
  { key: "productJacket", src: bomberJacket, price: 3500 },
  { key: "productPoncho", src: knitPoncho, price: 2200 },
  { key: "productSet", src: yellowSet, price: 4000 },
]
