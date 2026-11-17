"use client"

import { errorCodeOf } from "../../../../convex/lib/errors"
import { ErrorState } from "@/components/states/states"
import { AccountSuspended } from "@/features/auth/account-suspended"

/**
 * Safety net: if a query fails with ACCOUNT_SUSPENDED before the gate
 * notices, show the suspended screen rather than a generic error.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  if (errorCodeOf(error) === "ACCOUNT_SUSPENDED") return <AccountSuspended header={false} />
  return <ErrorState onRetry={reset} />
}
