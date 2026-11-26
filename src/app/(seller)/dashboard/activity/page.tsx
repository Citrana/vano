"use client"

import { ErrorState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { ActivityPage } from "@/features/activity/activity-page"

export default function DashboardActivityPage() {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      <ActivityPage />
    </QueryBoundary>
  )
}
