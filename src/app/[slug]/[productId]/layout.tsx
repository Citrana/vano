import { notFound, redirect } from "next/navigation"
import { getProductPage, getShopBasics, getSlugRedirect } from "@/features/public/data"

/**
 * Real 404 for an unknown / foreign product id (see ../layout.tsx). An old
 * shop link redirects (307: the old link is freed after a while) to the
 * same product under the new link.
 */
export default async function ProductLayout({ children, params }: LayoutProps<"/[slug]/[productId]">) {
  const { slug, productId } = await params
  if (!(await getShopBasics(slug))) {
    const moved = await getSlugRedirect(slug)
    if (moved) redirect(`/${moved.slug}/${encodeURIComponent(productId)}`)
  }
  if (!(await getProductPage(slug, productId))) notFound()
  return children
}
