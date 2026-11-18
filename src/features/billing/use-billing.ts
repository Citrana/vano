"use client"

import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useState } from "react"
import { api } from "../../../convex/_generated/api"

export type MyBilling = FunctionReturnType<typeof api.billing.mine>

/**
 * The caller's plan, limits and usage: undefined while loading, null when
 * their role can't see billing (`ownBilling.manage`), so custom roles
 * never hit a FORBIDDEN error.
 */
export function useMyBilling(): MyBilling | null | undefined {
  const viewer = useQuery(api.users.viewer, {})
  const allowed = viewer?.permissions.includes("ownBilling.manage") ?? false
  const billing = useQuery(api.billing.mine, allowed ? {} : "skip")
  if (viewer === undefined) return undefined
  return allowed ? billing : null
}

/**
 * The time when the component mounted. Day counts are computed from it so
 * rendering stays pure (Convex queries don't read the clock either).
 */
export function useNow(): number {
  const [now] = useState(() => Date.now())
  return now
}
