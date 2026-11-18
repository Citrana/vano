import { ChangeRequestsSection } from "@/features/admin/change-requests/change-requests-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminChangeRequestsPage() {
  return (
    <RequirePermission permission="changeRequests.view">
      <ChangeRequestsSection />
    </RequirePermission>
  )
}
