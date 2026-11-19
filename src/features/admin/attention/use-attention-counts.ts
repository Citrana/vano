"use client"

import { useQuery } from "convex/react"
import { useEffect, useState } from "react"
import { api } from "../../../../convex/_generated/api"

const STEP_MS = 5 * 60_000

/** "Now" rounded down to 5 minutes, ticking, so the query stays cached and still moves on. */
function useRoundedNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / STEP_MS) * STEP_MS)
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / STEP_MS) * STEP_MS), STEP_MS)
    return () => clearInterval(id)
  }, [])
  return now
}

/**
 * Live "needs attention" numbers (sidebar badges, dashboard cards). The
 * same arguments everywhere, so every caller shares one subscription.
 * A null number means the viewer may not see it.
 */
export function useAttentionCounts() {
  const now = useRoundedNow()
  return { now, counts: useQuery(api.admin.attention.counts, { now }) }
}

export type AttentionCounts = NonNullable<ReturnType<typeof useAttentionCounts>["counts"]>
export type AttentionKey = keyof AttentionCounts
