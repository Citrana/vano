import {
  ChartColumnIcon,
  HistoryIcon,
  ContactIcon,
  CreditCardIcon,
  FileBarChartIcon,
  HouseIcon,
  PackageIcon,
  PaletteIcon,
  ReceiptTextIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TagIcon,
  TicketPercentIcon,
  UsersRoundIcon,
} from "lucide-react"
import type { PermissionRequirement } from "../../../convex/lib/access"
import type { NavItem } from "../../components/shell/nav/nav-model"

/**
 * The seller menu (CLAUDE.md "UI"): the only list of seller pages. The
 * desktop sidebar, the phone bottom bar and its "More" sheet are all built
 * from it. Adding a page = one line here + `Seller.nav.<key>` in EN and FR.
 *
 * - `ready: false` until the page ships (never shown).
 * - `permission`: hidden from users without it.
 * - `feature`: a plan feature the page needs. The item shows a lock and
 *   still opens the page, which explains the plan ("Available on …").
 * - `mobile: "tab"`: one of the phone bottom-bar tabs (keep it to 4).
 * - `badge`: a live count from `useSellerNavCounts`.
 */
export const SELLER_NAV_GROUPS = ["shop", "sell", "insights", "account"] as const
export type SellerNavGroup = (typeof SELLER_NAV_GROUPS)[number]

/** Live counts that can badge a seller item (none yet: add a key and its source in `useSellerNavCounts`). */
export type SellerNavBadge = never

export type SellerNavKey =
  | "home"
  | "products"
  | "look"
  | "settings"
  | "offers"
  | "discountCodes"
  | "sales"
  | "orders"
  | "customers"
  | "stats"
  | "reports"
  | "plan"
  | "team"
  | "activity"

export type SellerNavItem = NavItem<SellerNavKey, SellerNavGroup, SellerNavBadge>

export const SELLER_HOME = "/dashboard"

export const SELLER_NAV: readonly SellerNavItem[] = [
  { key: "home", href: SELLER_HOME, icon: HouseIcon, group: "shop", permission: "ownShop.view", exact: true, mobile: "tab", ready: true },
  { key: "products", href: "/dashboard/products", icon: PackageIcon, group: "shop", permission: "ownProducts.view", mobile: "tab", ready: true },
  { key: "look", href: "/dashboard/look", icon: PaletteIcon, group: "shop", permission: "ownLook.manage", mobile: "tab", ready: true },
  { key: "settings", href: "/dashboard/settings", icon: SettingsIcon, group: "shop", permission: "ownShop.manage", ready: true },
  { key: "offers", href: "/dashboard/offers", icon: TagIcon, group: "sell", permission: "ownOffers.manage", feature: "salesPromotions", mobile: "tab", ready: true },
  { key: "discountCodes", href: "/dashboard/discount-codes", icon: TicketPercentIcon, group: "sell", permission: "ownOffers.manage", feature: "discountCodes", ready: true },
  { key: "sales", href: "/dashboard/sales", icon: ReceiptTextIcon, group: "sell", permission: "ownSales.manage", feature: "salesReports", ready: true },
  { key: "orders", href: "/dashboard/orders", icon: ShoppingBagIcon, group: "sell", permission: "ownSales.manage", feature: "orderTracking", ready: false },
  { key: "customers", href: "/dashboard/customers", icon: ContactIcon, group: "sell", permission: "ownCustomers.view", ready: false },
  { key: "stats", href: "/dashboard/stats", icon: ChartColumnIcon, group: "insights", permission: "ownStats.view", feature: "shopStats", ready: true },
  { key: "reports", href: "/dashboard/reports", icon: FileBarChartIcon, group: "insights", permission: "ownReports.view", feature: "salesReports", ready: true },
  { key: "plan", href: "/dashboard/billing", icon: CreditCardIcon, group: "account", permission: "ownBilling.manage", ready: true },
  { key: "team", href: "/dashboard/team", icon: UsersRoundIcon, group: "account", permission: "ownTeam.manage", feature: "teamRoles", ready: true },
  { key: "activity", href: "/dashboard/activity", icon: HistoryIcon, group: "account", permission: "ownActivity.view", feature: "teamRoles", ready: true },
]

/** Seller pages not in the menu that need more than their menu item (CLAUDE.md "Team accounts"). */
const EXTRA_PAGES: readonly { prefix: string; permission: PermissionRequirement }[] = [
  // The product form (new / edit); the list only needs to view products.
  { prefix: "/dashboard/products/", permission: "ownProducts.manage" },
]

/**
 * What a seller page needs (the menu item's permission, or a stricter
 * extra rule): the longest matching prefix wins; null = any seller page
 * that isn't role-specific (e.g. notifications). Pure; the dashboard
 * layout's guard uses it. Hiding a page is never security.
 */
export function pagePermission(pathname: string): PermissionRequirement | null {
  const path = pathname.replace(/\/+$/, "") || "/"
  const rules = [
    ...SELLER_NAV.map((item) => ({ prefix: item.href, exact: item.exact === true, permission: item.permission })),
    ...EXTRA_PAGES.map((page) => ({ ...page, exact: false })),
  ]
  let best: { length: number; permission: PermissionRequirement | undefined } | null = null
  for (const rule of rules) {
    const matches = rule.exact
      ? path === rule.prefix
      : rule.prefix.endsWith("/")
        ? path.startsWith(rule.prefix)
        : path === rule.prefix || path.startsWith(`${rule.prefix}/`)
    if (matches && (best === null || rule.prefix.length > best.length)) best = { length: rule.prefix.length, permission: rule.permission }
  }
  return best?.permission ?? null
}
