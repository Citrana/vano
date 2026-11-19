import type { Permission } from "../../../../convex/lib/permissions"

/**
 * The admin sidebar (CLAUDE.md "UI"): the only list of admin sections.
 * A section shows (and can be a redirect target) only when it's `ready`
 * and the user holds its `permission`. Each section's step flips `ready`
 * when its page ships, so the sidebar never links to a missing page.
 *
 * Hiding is not security: every admin function checks on the server.
 */
export type AdminNavKey =
  | "dashboard"
  | "users"
  | "shops"
  | "changeRequests"
  | "products"
  | "subscriptions"
  | "payments"
  | "roles"
  | "activity"
  | "settings"

/** Live counts that can badge a sidebar item (`admin.attention.counts`). */
export type AdminNavAttention = "pendingChangeRequests" | "failedPayments"

export type AdminNavItem = {
  key: AdminNavKey
  href: string
  permission: Permission
  ready: boolean
  /** Shows this live count next to the link when it's above zero. */
  attention?: AdminNavAttention
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { key: "dashboard", href: "/admin", permission: "dashboard.view", ready: true },
  { key: "users", href: "/admin/users", permission: "users.view", ready: true },
  { key: "shops", href: "/admin/shops", permission: "shops.view", ready: true },
  { key: "changeRequests", href: "/admin/change-requests", permission: "changeRequests.view", ready: true, attention: "pendingChangeRequests" },
  { key: "products", href: "/admin/products", permission: "products.view", ready: true },
  { key: "subscriptions", href: "/admin/subscriptions", permission: "billing.view", ready: true },
  { key: "payments", href: "/admin/payments", permission: "billing.view", ready: true, attention: "failedPayments" },
  { key: "roles", href: "/admin/roles", permission: "roles.view", ready: true },
  { key: "activity", href: "/admin/activity", permission: "audit.view", ready: true },
  { key: "settings", href: "/admin/settings", permission: "settings.view", ready: true },
]

/** The admin home; open to every admin, whatever their permissions. */
export const ADMIN_HOME = "/admin"

export function visibleNav(
  permissions: readonly string[],
  nav: readonly AdminNavItem[] = ADMIN_NAV,
): AdminNavItem[] {
  return nav.filter((item) => item.ready && permissions.includes(item.permission))
}

/** Where to send someone who opened a section they can't use. */
export function firstAllowedAdminPath(
  permissions: readonly string[],
  nav: readonly AdminNavItem[] = ADMIN_NAV,
): string {
  return visibleNav(permissions, nav)[0]?.href ?? ADMIN_HOME
}

/** Whether a nav link is the current page (the home only matches itself). */
export function isActive(href: string, pathname: string): boolean {
  return href === ADMIN_HOME ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}
