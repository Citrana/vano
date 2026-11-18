import "server-only"
import { fetchQuery } from "convex/nextjs"
import { cache } from "react"
import { api } from "../../../convex/_generated/api"

/**
 * Server-side reads for the public pages, deduplicated per request so
 * `generateMetadata` and the page share one Convex call.
 */
export const getShopBasics = cache((slug: string) => fetchQuery(api.public.shopBasics, { slug }))

/** An old shop link that still redirects (after an approved link change), or null. */
export const getSlugRedirect = cache((slug: string) => fetchQuery(api.public.slugRedirect, { slug }))

export const getShopPage = cache((slug: string) => fetchQuery(api.public.shopBySlug, { slug }))

export const getProductPage = cache((slug: string, productId: string) =>
  fetchQuery(api.public.productForPage, { slug, productId }),
)

/** A suspended shop only exposes its name and language. */
type Active<T> = Extract<NonNullable<T>, { suspended: false }>
export type ShopPage = Active<Awaited<ReturnType<typeof getShopPage>>>
export type PublicShop = ShopPage["shop"]
export type PublicProductCard = ShopPage["products"][number]
export type ProductPage = Active<Awaited<ReturnType<typeof getProductPage>>>
