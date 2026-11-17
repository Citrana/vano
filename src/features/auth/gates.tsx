"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { api } from "../../../convex/_generated/api"
import { LoadingState } from "@/components/states/states"

/**
 * Client-side route protection (CLAUDE.md "Security & ownership"): Convex
 * Auth's proxy-based protection has an open upstream bug with Next's
 * proxy.ts. The real boundary is server-side, in every Convex function.
 *
 * - `need="guest"`: login / signup — signed-in users go to the dashboard.
 * - `need="noShop"`: onboarding — sellers with a shop go to the dashboard.
 * - `need="shop"`: dashboard — no session → /login, no shop → /onboarding.
 */
export function SellerGate({ need, children }: { need: "guest" | "noShop" | "shop"; children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip")
  const router = useRouter()

  const target = (() => {
    if (isLoading) return "wait"
    if (!isAuthenticated) return need === "guest" ? "show" : "/login"
    if (viewer === undefined) return "wait"
    if (viewer === null) return need === "guest" ? "show" : "/login"
    if (need === "guest") return "/dashboard"
    if (need === "noShop") return viewer.hasShop ? "/dashboard" : "show"
    return viewer.hasShop ? "show" : "/onboarding"
  })()

  useEffect(() => {
    if (target !== "wait" && target !== "show") router.replace(target)
  }, [target, router])

  return target === "show" ? <>{children}</> : <LoadingState className="min-h-[60vh]" />
}
