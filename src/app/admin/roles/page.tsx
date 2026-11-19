import { Suspense } from "react"
import { LoadingState } from "@/components/states/states"
import { RolesSection } from "@/features/admin/roles/roles-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminRolesPage() {
  return (
    <RequirePermission permission="roles.view">
      {/* The section reads its filters from the URL. */}
      <Suspense fallback={<LoadingState />}>
        <RolesSection />
      </Suspense>
    </RequirePermission>
  )
}
