import { PaymentsSection } from "@/features/admin/billing/payments-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminPaymentsPage() {
  return (
    <RequirePermission permission="billing.view">
      <PaymentsSection />
    </RequirePermission>
  )
}
