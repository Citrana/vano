import { RequirePermission } from "@/features/admin/shell/admin-gate"
import { UsersSection } from "@/features/admin/users/users-section"

export default function AdminUsersPage() {
  return (
    <RequirePermission permission="users.view">
      <UsersSection />
    </RequirePermission>
  )
}
