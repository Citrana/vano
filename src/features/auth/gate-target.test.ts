import { describe, expect, test } from "vitest"
import { sellerGateTarget, type GateNeed, type GateViewer } from "./gate-target"

const target = (need: GateNeed, viewer: GateViewer | undefined, auth = { isLoading: false, isAuthenticated: true }) =>
  sellerGateTarget({ need, viewer, ...auth })

const SELLER = ["ownShop.manage", "ownProducts.manage", "ownStats.view"]
const viewer = (over: Partial<NonNullable<GateViewer>> = {}): GateViewer => ({
  hasShop: true,
  status: "active",
  isAdmin: false,
  permissions: SELLER,
  ...over,
})

describe("sellerGateTarget", () => {
  test("waits while auth or the viewer is loading", () => {
    expect(target("shop", undefined, { isLoading: true, isAuthenticated: false })).toBe("wait")
    expect(target("shop", undefined)).toBe("wait")
  })

  test("signed out: guest pages show, others go to /login", () => {
    const out = { isLoading: false, isAuthenticated: false }
    expect(target("guest", undefined, out)).toBe("show")
    expect(target("shop", undefined, out)).toBe("/login")
    expect(target("noShop", undefined, out)).toBe("/login")
    // A token for a user that no longer exists.
    expect(target("guest", null)).toBe("show")
    expect(target("shop", null)).toBe("/login")
  })

  test("active seller redirects", () => {
    expect(target("guest", viewer())).toBe("/dashboard")
    expect(target("noShop", viewer())).toBe("/dashboard")
    expect(target("noShop", viewer({ hasShop: false }))).toBe("show")
    expect(target("shop", viewer())).toBe("show")
    expect(target("shop", viewer({ hasShop: false }))).toBe("/onboarding")
  })

  test("after login, admins go to /admin", () => {
    expect(target("guest", viewer({ isAdmin: true }))).toBe("/admin")
    expect(target("guest", viewer({ isAdmin: true, status: "suspended" }))).toBe("/admin")
  })

  test("an admin who can also sell keeps the seller pages", () => {
    expect(target("shop", viewer({ isAdmin: true }))).toBe("show")
    expect(target("noShop", viewer({ isAdmin: true, hasShop: false }))).toBe("show")
  })

  test("someone who can't sell is kept out of the seller pages", () => {
    const support = viewer({ isAdmin: true, permissions: ["users.view"], hasShop: false })
    expect(target("shop", support)).toBe("/admin")
    expect(target("noShop", support)).toBe("/admin")
    const nothing = viewer({ permissions: [], hasShop: false })
    expect(target("shop", nothing)).toBe("noAccess")
  })

  test("a suspended account sees the suspended screen on seller pages", () => {
    expect(target("shop", viewer({ status: "suspended" }))).toBe("suspended")
    expect(target("noShop", viewer({ status: "suspended", hasShop: false }))).toBe("suspended")
    expect(target("guest", viewer({ status: "suspended" }))).toBe("/dashboard")
  })
})
