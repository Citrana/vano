"use client"

import { Suspense } from "react"
import { ErrorState, LoadingState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { ReportsPage } from "@/features/reports/reports-page"

export default function SalesReportsPage() {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      {/* The month lives in the address (useSearchParams). */}
      <Suspense fallback={<LoadingState />}>
        <ReportsPage />
      </Suspense>
    </QueryBoundary>
  )
}
