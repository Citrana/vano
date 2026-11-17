"use client"

import { ErrorState } from "@/components/states/states"

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState onRetry={reset} />
}
