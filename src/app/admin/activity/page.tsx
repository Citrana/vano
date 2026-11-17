import { ActivitySection } from "@/features/admin/activity/activity-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminActivityPage() {
  return (
    <RequirePermission permission="audit.view">
      <ActivitySection />
    </RequirePermission>
  )
}
