import { Suspense } from "react"
import { LoadingState } from "@/components/states/states"
import { ChangeRequestsSection } from "@/features/admin/change-requests/change-requests-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminChangeRequestsPage() {
  return (
    <RequirePermission permission="changeRequests.view">
      {/* The section reads its filters from the URL. */}
      <Suspense fallback={<LoadingState />}>
        <ChangeRequestsSection />
      </Suspense>
    </RequirePermission>
  )
}
