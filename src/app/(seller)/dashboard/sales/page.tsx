"use client"

import { Suspense } from "react"
import { ErrorState, LoadingState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { SalesList } from "@/features/sales/sales-list"

export default function SalesPage() {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      {/* The status filter lives in the address (useSearchParams). */}
      <Suspense fallback={<LoadingState />}>
        <SalesList />
      </Suspense>
    </QueryBoundary>
  )
}
