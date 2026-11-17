"use client"

import type { Permission } from "../../../../convex/lib/permissions"
import { useAdminViewer } from "../shell/use-admin-viewer"

/** Whether the viewer may grant a permission: super admins can grant all. */
export function useCanGrant() {
  const { viewer } = useAdminViewer()
  return (permission: Permission) =>
    viewer?.roleKey === "super_admin" || (viewer?.permissions.includes(permission) ?? false)
}
