import { Suspense } from "react"
import { LoadingState } from "@/components/states/states"
import { RequirePermission } from "@/features/admin/shell/admin-gate"
import { UsersSection } from "@/features/admin/users/users-section"

export default function AdminUsersPage() {
  return (
    <RequirePermission permission="users.view">
      {/* The section reads its filters from the URL. */}
      <Suspense fallback={<LoadingState />}>
        <UsersSection />
      </Suspense>
    </RequirePermission>
  )
}
