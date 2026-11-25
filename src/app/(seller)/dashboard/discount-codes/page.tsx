"use client"

import { Suspense } from "react"
import { ErrorState, LoadingState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { CodesList } from "@/features/discount-codes/codes-list"

export default function DiscountCodesPage() {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      {/* The status filter lives in the address (useSearchParams). */}
      <Suspense fallback={<LoadingState />}>
        <CodesList />
      </Suspense>
    </QueryBoundary>
  )
}
