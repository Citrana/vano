import { Suspense } from "react"
import { LoadingState } from "@/components/states/states"
import { PaymentsSection } from "@/features/admin/billing/payments-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminPaymentsPage() {
  return (
    <RequirePermission permission="billing.view">
      {/* The section reads its filters from the URL. */}
      <Suspense fallback={<LoadingState />}>
        <PaymentsSection />
      </Suspense>
    </RequirePermission>
  )
}
