"use client"

// First, before any form schema runs: no eval probe under the CSP.
import "./zod-config"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { ConvexReactClient } from "convex/react"
import { type ReactNode } from "react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return <>{children}</>
  }
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>
}
