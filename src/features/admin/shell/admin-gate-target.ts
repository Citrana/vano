import type { Permission } from "../../../../convex/lib/permissions"
import { canSell, type GateViewer } from "../../auth/gate-target"
import { firstAllowedAdminPath } from "./nav"

/**
 * What an /admin page should do for the current visitor. Pure, so it's
 * unit-tested. Client-side routing only: the server checks every call.
 *
 * Signed out → /login. Suspended → the suspended screen. Not an admin →
 * the dashboard (or "noAccess" if they can't sell either, so there is no
 * redirect loop). Missing this page's permission → the first section they
 * can open.
 */
export type AdminGateTarget = "wait" | "show" | "suspended" | "noAccess" | "/login" | "/dashboard" | string

export function adminGateTarget({
  isLoading,
  isAuthenticated,
  viewer,
  permission,
}: {
  isLoading: boolean
  isAuthenticated: boolean
  viewer: GateViewer | undefined
  permission?: Permission
}): AdminGateTarget {
  if (isLoading) return "wait"
  if (!isAuthenticated) return "/login"
  if (viewer === undefined) return "wait"
  if (viewer === null) return "/login"
  if (viewer.status === "suspended") return "suspended"
  if (!viewer.isAdmin) return canSell(viewer) ? "/dashboard" : "noAccess"
  if (permission && !viewer.permissions.includes(permission)) {
    return firstAllowedAdminPath(viewer.permissions)
  }
  return "show"
}
