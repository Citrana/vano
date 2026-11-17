import { describe, expect, test } from "vitest"
import { sellerGateTarget, type GateNeed, type GateViewer } from "./gate-target"

const target = (need: GateNeed, viewer: GateViewer | undefined, auth = { isLoading: false, isAuthenticated: true }) =>
  sellerGateTarget({ need, viewer, ...auth })

const active = (hasShop: boolean): GateViewer => ({ hasShop, status: "active" })
const suspended = (hasShop: boolean): GateViewer => ({ hasShop, status: "suspended" })

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
    expect(target("guest", active(true))).toBe("/dashboard")
    expect(target("noShop", active(true))).toBe("/dashboard")
    expect(target("noShop", active(false))).toBe("show")
    expect(target("shop", active(true))).toBe("show")
    expect(target("shop", active(false))).toBe("/onboarding")
  })

  test("a suspended account sees the suspended screen on seller pages", () => {
    expect(target("shop", suspended(true))).toBe("suspended")
    expect(target("shop", suspended(false))).toBe("suspended")
    expect(target("noShop", suspended(false))).toBe("suspended")
    // From login / signup it goes to the dashboard, which shows the screen.
    expect(target("guest", suspended(true))).toBe("/dashboard")
  })
})
