"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { api } from "../../../convex/_generated/api"
import { LoadingState } from "@/components/states/states"
import { AccountSuspended } from "./account-suspended"
import { sellerGateTarget, type GateNeed } from "./gate-target"
import { NoAccess } from "./no-access"
import { MemberPaused } from "@/features/team/member-paused"

/**
 * Client-side route protection (CLAUDE.md "Security & ownership"): Convex
 * Auth's proxy-based protection has an open upstream bug with Next's
 * proxy.ts. The real boundary is server-side, in every Convex function.
 * The rules live in `sellerGateTarget` (gate-target.ts).
 */
export function SellerGate({
  need,
  doneHref,
  next,
  children,
}: {
  need: GateNeed
  /** Onboarding: where a seller who now has a shop goes (default: the dashboard). */
  doneHref?: string
  /** Login / signup: where to go once signed in (from `nextParam`). */
  next?: string
  children: ReactNode
}) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip")
  const router = useRouter()
  const gate = sellerGateTarget({ need, isLoading, isAuthenticated, viewer, next })
  const target = need === "noShop" && gate === "/dashboard" && doneHref ? doneHref : gate

  useEffect(() => {
    if (target.startsWith("/")) router.replace(target)
  }, [target, router])

  if (target === "show") return <>{children}</>
  // Onboarding already has its own top bar around the gate.
  if (target === "suspended") return <AccountSuspended header={need !== "noShop"} />
  if (target === "noAccess") return <NoAccess />
  if (target === "memberPaused") return <MemberPaused />
  return <LoadingState className="min-h-[60vh]" />
}
