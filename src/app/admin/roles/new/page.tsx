import { NewRole } from "@/features/admin/roles/new-role"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminNewRolePage() {
  return (
    <RequirePermission permission="roles.manage">
      <NewRole />
    </RequirePermission>
  )
}
