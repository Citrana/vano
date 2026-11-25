import {
  ChartColumnIcon,
  ContactIcon,
  CreditCardIcon,
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
  | "plan"
  | "team"

export type SellerNavItem = NavItem<SellerNavKey, SellerNavGroup, SellerNavBadge>

export const SELLER_HOME = "/dashboard"

export const SELLER_NAV: readonly SellerNavItem[] = [
  { key: "home", href: SELLER_HOME, icon: HouseIcon, group: "shop", permission: "ownShop.manage", exact: true, mobile: "tab", ready: true },
  { key: "products", href: "/dashboard/products", icon: PackageIcon, group: "shop", permission: "ownProducts.manage", mobile: "tab", ready: true },
  { key: "look", href: "/dashboard/look", icon: PaletteIcon, group: "shop", permission: "ownShop.manage", mobile: "tab", ready: true },
  { key: "settings", href: "/dashboard/settings", icon: SettingsIcon, group: "shop", permission: "ownShop.manage", ready: true },
  { key: "offers", href: "/dashboard/offers", icon: TagIcon, group: "sell", permission: "ownProducts.manage", feature: "salesPromotions", mobile: "tab", ready: true },
  { key: "discountCodes", href: "/dashboard/discount-codes", icon: TicketPercentIcon, group: "sell", permission: "ownProducts.manage", feature: "discountCodes", ready: true },
  { key: "sales", href: "/dashboard/sales", icon: ReceiptTextIcon, group: "sell", permission: "ownSales.manage", feature: "salesReports", ready: true },
  { key: "orders", href: "/dashboard/orders", icon: ShoppingBagIcon, group: "sell", permission: "ownShop.manage", feature: "orderTracking", ready: false },
  { key: "customers", href: "/dashboard/customers", icon: ContactIcon, group: "sell", permission: "ownShop.manage", ready: false },
  { key: "stats", href: "/dashboard/stats", icon: ChartColumnIcon, group: "insights", permission: "ownStats.view", feature: "shopStats", ready: true },
  { key: "plan", href: "/dashboard/billing", icon: CreditCardIcon, group: "account", permission: "ownBilling.manage", ready: true },
  { key: "team", href: "/dashboard/team", icon: UsersRoundIcon, group: "account", permission: "ownShop.manage", ready: false },
]
