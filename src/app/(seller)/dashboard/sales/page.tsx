"use client"

import { Suspense } from "react"
import { ErrorState, LoadingState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { SalesPage } from "@/features/sales-records/sales-page"

export default function SalesRecordsPage() {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      {/* Filters live in the address (useSearchParams). */}
      <Suspense fallback={<LoadingState />}>
        <SalesPage />
      </Suspense>
    </QueryBoundary>
  )
}
