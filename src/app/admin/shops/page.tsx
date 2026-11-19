import { Suspense } from "react"
import { LoadingState } from "@/components/states/states"
import { RequirePermission } from "@/features/admin/shell/admin-gate"
import { ShopsSection } from "@/features/admin/shops/shops-section"

export default function AdminShopsPage() {
  return (
    <RequirePermission permission="shops.view">
      {/* The section reads its filters from the URL. */}
      <Suspense fallback={<LoadingState />}>
        <ShopsSection />
      </Suspense>
    </RequirePermission>
  )
}
