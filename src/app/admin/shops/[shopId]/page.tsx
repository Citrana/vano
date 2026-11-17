import { RequirePermission } from "@/features/admin/shell/admin-gate"
import { ShopDetails } from "@/features/admin/shops/shop-details"

export default async function AdminShopPage({ params }: PageProps<"/admin/shops/[shopId]">) {
  const { shopId } = await params
  return (
    <RequirePermission permission="shops.view">
      <ShopDetails shopId={shopId} />
    </RequirePermission>
  )
}
