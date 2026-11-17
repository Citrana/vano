import "server-only"
import { fetchQuery } from "convex/nextjs"
import { cache } from "react"
import { api } from "../../../convex/_generated/api"

/**
 * Server-side reads for the public pages, deduplicated per request so
 * `generateMetadata` and the page share one Convex call.
 */
export const getShopBasics = cache((slug: string) => fetchQuery(api.public.shopBasics, { slug }))

export const getShopPage = cache((slug: string) => fetchQuery(api.public.shopBySlug, { slug }))

export const getProductPage = cache((slug: string, productId: string) =>
  fetchQuery(api.public.productForPage, { slug, productId }),
)

export type ShopPage = NonNullable<Awaited<ReturnType<typeof getShopPage>>>
export type PublicShop = ShopPage["shop"]
export type PublicProductCard = ShopPage["products"][number]
export type ProductPage = NonNullable<Awaited<ReturnType<typeof getProductPage>>>
