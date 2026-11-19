import { redirect } from "next/navigation"
import { getShopBasics, getSlugRedirect } from "@/features/public/data"

/**
 * An old shop link redirects to the shop's current link (after an approved
 * link change). Sits outside this group's loading.tsx, so the redirect is a
 * real 307 (temporary: the old link is freed after a while), not a
 * streamed one.
 */
export default async function ShopHomeLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params
  if (!(await getShopBasics(slug))) {
    const moved = await getSlugRedirect(slug)
    if (moved) redirect(`/${moved.slug}`)
  }
  return children
}
