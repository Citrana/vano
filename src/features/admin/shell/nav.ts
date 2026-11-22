import {
  CreditCardIcon,
  FilePenLineIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react"
import type { Permission } from "../../../../convex/lib/permissions"
import { visibleNav as visibleItems, type NavItem } from "../../../components/shell/nav/nav-model"

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
  | "plans"
  | "roles"
  | "activity"
  | "settings"

/** Live counts that can badge a sidebar item (`admin.attention.counts`). */
export type AdminNavAttention = "pendingChangeRequests" | "failedPayments"

export type AdminNavItem = NavItem<AdminNavKey, never, AdminNavAttention> & { permission: Permission }

/** The admin home; open to every admin, whatever their permissions. */
export const ADMIN_HOME = "/admin"

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { key: "dashboard", href: ADMIN_HOME, icon: LayoutDashboardIcon, permission: "dashboard.view", exact: true, ready: true },
  { key: "users", href: "/admin/users", icon: UsersIcon, permission: "users.view", ready: true },
  { key: "shops", href: "/admin/shops", icon: StoreIcon, permission: "shops.view", ready: true },
  { key: "changeRequests", href: "/admin/change-requests", icon: FilePenLineIcon, permission: "changeRequests.view", ready: true, badge: "pendingChangeRequests" },
  { key: "products", href: "/admin/products", icon: PackageIcon, permission: "products.view", ready: true },
  { key: "subscriptions", href: "/admin/subscriptions", icon: CreditCardIcon, permission: "billing.view", ready: true },
  { key: "payments", href: "/admin/payments", icon: ReceiptIcon, permission: "billing.view", ready: true, badge: "failedPayments" },
  { key: "plans", href: "/admin/plans", icon: ListChecksIcon, permission: "plans.manage", ready: true },
  { key: "roles", href: "/admin/roles", icon: ShieldCheckIcon, permission: "roles.view", ready: true },
  { key: "activity", href: "/admin/activity", icon: HistoryIcon, permission: "audit.view", ready: true },
  { key: "settings", href: "/admin/settings", icon: SettingsIcon, permission: "settings.view", ready: true },
]

export function visibleNav(
  permissions: readonly string[],
  nav: readonly AdminNavItem[] = ADMIN_NAV,
): AdminNavItem[] {
  return visibleItems(permissions, nav)
}

/** Where to send someone who opened a section they can't use. */
export function firstAllowedAdminPath(
  permissions: readonly string[],
  nav: readonly AdminNavItem[] = ADMIN_NAV,
): string {
  return visibleNav(permissions, nav)[0]?.href ?? ADMIN_HOME
}
