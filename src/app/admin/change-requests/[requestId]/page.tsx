import { ChangeRequestDetails } from "@/features/admin/change-requests/change-request-details"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default async function AdminChangeRequestPage({ params }: PageProps<"/admin/change-requests/[requestId]">) {
  const { requestId } = await params
  return (
    <RequirePermission permission="changeRequests.view">
      <ChangeRequestDetails requestId={requestId} />
    </RequirePermission>
  )
}
