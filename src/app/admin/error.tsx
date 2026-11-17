"use client"

import { errorCodeOf } from "../../../convex/lib/errors"
import { ErrorState } from "@/components/states/states"
import { AccountSuspended } from "@/features/auth/account-suspended"

/** Like the dashboard's: ACCOUNT_SUSPENDED shows the suspended screen. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  if (errorCodeOf(error) === "ACCOUNT_SUSPENDED") return <AccountSuspended header={false} />
  return <ErrorState onRetry={reset} />
}
