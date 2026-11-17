import { notFound } from "next/navigation"
import { getShopBasics } from "@/features/public/data"

/**
 * Checks the shop exists *before* the page's loading boundary starts
 * streaming, so an unknown slug gets a real HTTP 404 (a notFound() thrown
 * under loading.tsx can only send 200 + noindex). Uses the light
 * `shopBasics` query, since this also runs for every product page.
 */
export default async function ShopLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params
  if (!(await getShopBasics(slug))) notFound()
  return children
}
