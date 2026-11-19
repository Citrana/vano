import { Suspense } from "react"
import { LoadingState } from "@/components/states/states"
import { SubscriptionsSection } from "@/features/admin/billing/subscriptions-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminSubscriptionsPage() {
  return (
    <RequirePermission permission="billing.view">
      {/* The section reads its filters from the URL. */}
      <Suspense fallback={<LoadingState />}>
        <SubscriptionsSection />
      </Suspense>
    </RequirePermission>
  )
}
