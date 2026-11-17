"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { api } from "../../../../convex/_generated/api"

/** The signed-in viewer (role, permissions…) for admin pages. */
export function useAdminViewer() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip")
  return { isLoading, isAuthenticated, viewer }
}

/** Built-in roles are translated; custom roles show their own name. */
export function useRoleLabel() {
  const t = useTranslations("Roles")
  return (viewer: { roleKey: "super_admin" | "seller" | null; roleName: string }) =>
    viewer.roleKey ? t(viewer.roleKey) : viewer.roleName
}
