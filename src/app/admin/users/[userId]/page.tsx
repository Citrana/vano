import { RequirePermission } from "@/features/admin/shell/admin-gate"
import { UserDetails } from "@/features/admin/users/user-details"

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[userId]">) {
  const { userId } = await params
  return (
    <RequirePermission permission="users.view">
      <UserDetails userId={userId} />
    </RequirePermission>
  )
}
