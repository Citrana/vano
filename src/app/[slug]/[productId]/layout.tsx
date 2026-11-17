import { notFound } from "next/navigation"
import { getProductPage } from "@/features/public/data"

/** Real 404 for an unknown / foreign product id (see ../layout.tsx). */
export default async function ProductLayout({ children, params }: LayoutProps<"/[slug]/[productId]">) {
  const { slug, productId } = await params
  if (!(await getProductPage(slug, productId))) notFound()
  return children
}
