import { HouseIcon } from "lucide-react"
import { describe, expect, test } from "vitest"
import { countFor, groupNav, isNavActive, splitForMobile, visibleNav, type NavItem } from "./nav-model"

const icon = HouseIcon
const items: NavItem<string, "a" | "b", "n">[] = [
  { key: "home", href: "/x", icon, group: "a", exact: true, mobile: "tab", ready: true },
  { key: "one", href: "/x/one", icon, group: "a", permission: "ownShop.manage", mobile: "tab", ready: true },
  { key: "two", href: "/x/two", icon, group: "b", permission: ["ownStats.view", "ownBilling.manage"], match: ["/x/old"], badge: "n", ready: true },
  { key: "soon", href: "/x/soon", icon, group: "b", ready: false },
]

describe("nav model", () => {
  test("hides unready items and items without the permission (a list = any of)", () => {
    expect(visibleNav([], items).map((i) => i.key)).toEqual(["home"])
    expect(visibleNav(["ownBilling.manage"], items).map((i) => i.key)).toEqual(["home", "two"])
    expect(visibleNav(["ownShop.manage", "ownStats.view"], items).map((i) => i.key)).toEqual(["home", "one", "two"])
  })

  test("active: exact items match only themselves, others their sub-pages and extra prefixes", () => {
    expect(isNavActive(items[0], "/x")).toBe(true)
    expect(isNavActive(items[0], "/x/one")).toBe(false)
    expect(isNavActive(items[1], "/x/one/edit")).toBe(true)
    expect(isNavActive(items[1], "/x/onex")).toBe(false)
    expect(isNavActive(items[2], "/x/old/1")).toBe(true)
  })

  test("groups follow the given order and drop empty ones", () => {
    const shown = visibleNav([], items)
    expect(groupNav(shown, ["b", "a"]).map((g) => g.group)).toEqual(["a"])
    expect(groupNav(items, ["b", "a"]).map((g) => [g.group, g.items.length])).toEqual([["b", 2], ["a", 2]])
  })

  test("phones: tabs and the rest", () => {
    const { tabs, more } = splitForMobile(items)
    expect(tabs.map((i) => i.key)).toEqual(["home", "one"])
    expect(more.map((i) => i.key)).toEqual(["two", "soon"])
  })

  test("a badge shows only above zero", () => {
    expect(countFor(items[2], { n: { count: 3, capped: false } })).toEqual({ count: 3, capped: false })
    expect(countFor(items[2], { n: { count: 0, capped: false } })).toBeNull()
    expect(countFor(items[2], { n: null })).toBeNull()
    expect(countFor(items[0], { n: { count: 3, capped: false } })).toBeNull()
  })
})
