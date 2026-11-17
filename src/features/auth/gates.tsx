"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { api } from "../../../convex/_generated/api"
import { LoadingState } from "@/components/states/states"
import { AccountSuspended } from "./account-suspended"
import { sellerGateTarget, type GateNeed } from "./gate-target"

/**
 * Client-side route protection (CLAUDE.md "Security & ownership"): Convex
 * Auth's proxy-based protection has an open upstream bug with Next's
 * proxy.ts. The real boundary is server-side, in every Convex function.
 * The rules live in `sellerGateTarget` (gate-target.ts).
 */
export function SellerGate({ need, children }: { need: GateNeed; children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip")
  const router = useRouter()
  const target = sellerGateTarget({ need, isLoading, isAuthenticated, viewer })

  useEffect(() => {
    if (target.startsWith("/")) router.replace(target)
  }, [target, router])

  if (target === "show") return <>{children}</>
  // Onboarding already has its own top bar around the gate.
  if (target === "suspended") return <AccountSuspended header={need !== "noShop"} />
  return <LoadingState className="min-h-[60vh]" />
}
