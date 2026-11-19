import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { getShopBasics, getSlugRedirect } from "@/features/public/data"
import { ShopUnavailable } from "@/features/public/shop-unavailable"

/** A suspended shop: "temporarily unavailable" title, kept out of search engines. */
export async function generateMetadata({ params }: LayoutProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const basics = await getShopBasics(slug)
  if (!basics?.suspended) return {}
  const t = await getTranslations({ locale: basics.language, namespace: "Public" })
  return {
    title: { absolute: t("unavailableMetaTitle", { shop: basics.name }) },
    robots: { index: false, follow: false },
  }
}

/**
 * Checks the shop exists *before* the page's loading boundary starts
 * streaming, so an unknown slug gets a real HTTP 404 (a notFound() thrown
 * under loading.tsx can only send 200 + noindex). Uses the light
 * `shopBasics` query, since this also runs for every product page.
 * A suspended shop shows the "temporarily unavailable" page instead of
 * the shop or any of its products. An old link that still redirects (an
 * approved link change) renders the children, whose layouts redirect to
 * the new link, keeping the product id for product pages.
 */
export default async function ShopLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params
  const basics = await getShopBasics(slug)
  if (!basics) {
    if (await getSlugRedirect(slug)) return children
    notFound()
  }
  if (basics.suspended) return <ShopUnavailable name={basics.name} language={basics.language} />
  return children
}
