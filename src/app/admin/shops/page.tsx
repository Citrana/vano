import { RequirePermission } from "@/features/admin/shell/admin-gate"
import { ShopsSection } from "@/features/admin/shops/shops-section"

export default function AdminShopsPage() {
  return (
    <RequirePermission permission="shops.view">
      <ShopsSection />
    </RequirePermission>
  )
}
