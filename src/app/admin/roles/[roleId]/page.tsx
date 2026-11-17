import { RoleDetails } from "@/features/admin/roles/role-details"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default async function AdminRolePage({ params }: PageProps<"/admin/roles/[roleId]">) {
  const { roleId } = await params
  return (
    <RequirePermission permission="roles.view">
      <RoleDetails roleId={roleId} />
    </RequirePermission>
  )
}
