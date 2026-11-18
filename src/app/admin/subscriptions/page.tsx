import { SubscriptionsSection } from "@/features/admin/billing/subscriptions-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminSubscriptionsPage() {
  return (
    <RequirePermission permission="billing.view">
      <SubscriptionsSection />
    </RequirePermission>
  )
}
