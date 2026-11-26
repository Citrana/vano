"use client"

import { Suspense } from "react"
import { ErrorState, LoadingState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { TeamPage } from "@/features/team/team-page"

export default function DashboardTeamPage() {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      {/* The open member lives in the address (useSearchParams). */}
      <Suspense fallback={<LoadingState />}>
        <TeamPage />
      </Suspense>
    </QueryBoundary>
  )
}
