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

type RoleKey = "super_admin" | "seller" | null

/**
 * Built-in roles are translated; custom roles show their own name. Accepts
 * the viewer / list-row shape (`roleKey`, `roleName`) or a role (`key`, `name`).
 */
export function useRoleLabel() {
  const t = useTranslations("Roles")
  return (role: { roleKey: RoleKey; roleName: string } | { key: RoleKey; name: string }) => {
    const [key, name] = "roleKey" in role ? [role.roleKey, role.roleName] : [role.key, role.name]
    return key ? t(key) : name
  }
}
