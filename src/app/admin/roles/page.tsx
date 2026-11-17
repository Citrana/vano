import { RolesSection } from "@/features/admin/roles/roles-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminRolesPage() {
  return (
    <RequirePermission permission="roles.view">
      <RolesSection />
    </RequirePermission>
  )
}
