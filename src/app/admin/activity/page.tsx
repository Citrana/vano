import { Suspense } from "react"
import { LoadingState } from "@/components/states/states"
import { ActivitySection } from "@/features/admin/activity/activity-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminActivityPage() {
  return (
    <RequirePermission permission="audit.view">
      {/* The section reads its filters from the URL. */}
      <Suspense fallback={<LoadingState />}>
        <ActivitySection />
      </Suspense>
    </RequirePermission>
  )
}
