"use client"

import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import type { Permission } from "../../../../convex/lib/permissions"
import { LoadingState } from "@/components/states/states"
import { AccountSuspended } from "@/features/auth/account-suspended"
import { NoAccess } from "@/features/auth/no-access"
import { adminGateTarget } from "./admin-gate-target"
import { useAdminViewer } from "./use-admin-viewer"

/**
 * Client-side routing for /admin (CLAUDE.md "Security & ownership"): the
 * real boundary is the permission check in every admin Convex function.
 * Without `permission`: any admin. With it: pages that need it.
 */
export function AdminGate({ permission, children }: { permission?: Permission; children: ReactNode }) {
  const { isLoading, isAuthenticated, viewer } = useAdminViewer()
  const router = useRouter()
  const target = adminGateTarget({ isLoading, isAuthenticated, viewer, permission })

  useEffect(() => {
    if (target.startsWith("/")) router.replace(target)
  }, [target, router])

  if (target === "show") return <>{children}</>
  if (target === "suspended") return <AccountSuspended />
  if (target === "noAccess") return <NoAccess />
  return <LoadingState className="min-h-[60vh]" />
}

/** Wraps an admin section page: `<RequirePermission permission="users.view">`. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  return <AdminGate permission={permission}>{children}</AdminGate>
}
