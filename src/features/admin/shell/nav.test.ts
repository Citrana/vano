import { describe, expect, test } from "vitest"
import { ADMIN_NAV, firstAllowedAdminPath, isActive, visibleNav, type AdminNavItem } from "./nav"

const nav: AdminNavItem[] = [
  { key: "dashboard", href: "/admin", permission: "dashboard.view", ready: true },
  { key: "users", href: "/admin/users", permission: "users.view", ready: true },
  { key: "shops", href: "/admin/shops", permission: "shops.view", ready: false },
  { key: "roles", href: "/admin/roles", permission: "roles.view", ready: true },
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

  test("isActive: the home only matches itself", () => {
    expect(isActive("/admin", "/admin")).toBe(true)
    expect(isActive("/admin", "/admin/users")).toBe(false)
    expect(isActive("/admin/users", "/admin/users/abc")).toBe(true)
    expect(isActive("/admin/users", "/admin/usersx")).toBe(false)
  })
})
