"use client"

import { ErrorState } from "@/components/states/states"

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center">
      <ErrorState onRetry={reset} />
    </main>
  )
}
