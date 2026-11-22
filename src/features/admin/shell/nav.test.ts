import { LayoutDashboardIcon } from "lucide-react"
import { describe, expect, test } from "vitest"
import { isNavActive } from "../../../components/shell/nav/nav-model"
import { ADMIN_HOME, ADMIN_NAV, firstAllowedAdminPath, visibleNav, type AdminNavItem } from "./nav"

const icon = LayoutDashboardIcon
const nav: AdminNavItem[] = [
  { key: "dashboard", href: "/admin", icon, permission: "dashboard.view", exact: true, ready: true },
  { key: "users", href: "/admin/users", icon, permission: "users.view", ready: true },
  { key: "shops", href: "/admin/shops", icon, permission: "shops.view", ready: false },
  { key: "roles", href: "/admin/roles", icon, permission: "roles.view", ready: true },
]

describe("admin nav", () => {
  test("shows only ready sections the user is allowed to open", () => {
    expect(visibleNav(["users.view", "shops.view"], nav).map((i) => i.key)).toEqual(["users"])
    expect(visibleNav([], nav)).toEqual([])
  })

  test("first allowed section follows the list order, else the admin home", () => {
    expect(firstAllowedAdminPath(["roles.view", "users.view"], nav)).toBe("/admin/users")
    expect(firstAllowedAdminPath(["shops.view"], nav)).toBe("/admin")
  })

  test("every section has a unique href and key", () => {
    expect(new Set(ADMIN_NAV.map((i) => i.href)).size).toBe(ADMIN_NAV.length)
    expect(new Set(ADMIN_NAV.map((i) => i.key)).size).toBe(ADMIN_NAV.length)
  })

  test("the admin home only matches itself", () => {
    const home = ADMIN_NAV.find((i) => i.href === ADMIN_HOME)!
    const users = ADMIN_NAV.find((i) => i.key === "users")!
    expect(isNavActive(home, "/admin")).toBe(true)
    expect(isNavActive(home, "/admin/users")).toBe(false)
    expect(isNavActive(users, "/admin/users/abc")).toBe(true)
    expect(isNavActive(users, "/admin/usersx")).toBe(false)
  })
})
