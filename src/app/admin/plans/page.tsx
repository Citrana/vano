import { Suspense } from "react"
import { LoadingState } from "@/components/states/states"
import { PlansSection } from "@/features/admin/plans/plans-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminPlansPage() {
  return (
    <RequirePermission permission="plans.manage">
      {/* The features grid reads its filters from the URL. */}
      <Suspense fallback={<LoadingState />}>
        <PlansSection />
      </Suspense>
    </RequirePermission>
  )
}
