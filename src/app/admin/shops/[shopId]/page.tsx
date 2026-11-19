import { redirect } from "next/navigation"
import { adminHref } from "@/features/admin/shell/hrefs"

/** Old link to one shop: the list now opens it in a drawer. */
export default async function AdminShopPage({ params }: PageProps<"/admin/shops/[shopId]">) {
  const { shopId } = await params
  redirect(adminHref.shop(shopId))
}
