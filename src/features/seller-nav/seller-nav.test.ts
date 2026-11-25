import { describe, expect, test } from "vitest"
import en from "../../../messages/en.json"
import fr from "../../../messages/fr.json"
import { SELLER_PERMISSIONS } from "../../../convex/lib/permissions"
import { isNavActive, splitForMobile, visibleNav } from "../../components/shell/nav/nav-model"
import { SELLER_NAV, SELLER_NAV_GROUPS } from "./seller-nav"

const ready = SELLER_NAV.filter((i) => i.ready)
const find = (key: string) => SELLER_NAV.find((i) => i.key === key)!

describe("seller nav", () => {
  test("keys and links are unique, all under /dashboard", () => {
    expect(new Set(SELLER_NAV.map((i) => i.key)).size).toBe(SELLER_NAV.length)
    expect(new Set(SELLER_NAV.map((i) => i.href)).size).toBe(SELLER_NAV.length)
    for (const item of SELLER_NAV) expect(item.href.startsWith("/dashboard")).toBe(true)
  })

  test("every item has a group and an EN/FR label", () => {
    for (const item of SELLER_NAV) {
      expect(SELLER_NAV_GROUPS).toContain(item.group)
      expect(en.Seller.nav[item.key]).toBeTruthy()
      expect(fr.Seller.nav[item.key]).toBeTruthy()
    }
    for (const group of SELLER_NAV_GROUPS) {
      expect(en.Seller.groups[group]).toBeTruthy()
      expect(fr.Seller.groups[group]).toBeTruthy()
    }
  })

  test("a seller sees every ready page, and only ready pages", () => {
    expect(visibleNav(SELLER_PERMISSIONS, SELLER_NAV)).toEqual(ready)
    expect(visibleNav(SELLER_PERMISSIONS, SELLER_NAV).map((i) => i.key)).not.toContain("team")
  })

  test("items need their permission", () => {
    const keys = visibleNav(["ownShop.manage"], SELLER_NAV).map((i) => i.key)
    expect(keys).toEqual(["home", "look", "settings"])
    expect(visibleNav([], SELLER_NAV)).toEqual([])
  })

  test("phones: Home, Products, Look and Offers tabs, the rest in More", () => {
    const { tabs, more } = splitForMobile(ready)
    expect(tabs.map((i) => i.key).sort()).toEqual(["home", "look", "offers", "products"])
    expect(more.map((i) => i.key)).toEqual(["settings", "discountCodes", "sales", "stats", "plan"])
  })

  test("the current page is highlighted, sub-pages included", () => {
    const active = (path: string) => ready.filter((i) => isNavActive(i, path)).map((i) => i.key)
    expect(active("/dashboard")).toEqual(["home"])
    expect(active("/dashboard/products")).toEqual(["products"])
    expect(active("/dashboard/products/new")).toEqual(["products"])
    expect(active("/dashboard/products/abc")).toEqual(["products"])
    expect(active("/dashboard/offers/xyz")).toEqual(["offers"])
    expect(active("/dashboard/sales")).toEqual(["sales"])
    expect(active("/dashboard/billing/checkout/p1")).toEqual(["plan"])
    expect(active("/dashboard/look")).toEqual(["look"])
    expect(active("/dashboard/settings")).toEqual(["settings"])
    expect(active("/dashboard/stats")).toEqual(["stats"])
    expect(active("/dashboard/notifications")).toEqual([])
  })

  test("locked pages name a plan feature", () => {
    expect(find("offers").feature).toBe("salesPromotions")
    expect(find("sales").feature).toBe("salesReports")
    expect(find("stats").feature).toBe("shopStats")
    expect(find("look").feature).toBeUndefined()
  })
})
