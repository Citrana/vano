import { describe, expect, test } from "vitest"
import type { GateViewer } from "../../auth/gate-target"
import { adminGateTarget } from "./admin-gate-target"

const signedIn = { isLoading: false, isAuthenticated: true }
const viewer = (over: Partial<NonNullable<GateViewer>> = {}): GateViewer => ({
  hasShop: false,
  status: "active",
  isAdmin: true,
  permissions: ["users.view"],
  ...over,
})

describe("adminGateTarget", () => {
  test("waits while loading", () => {
    expect(adminGateTarget({ isLoading: true, isAuthenticated: false, viewer: undefined })).toBe("wait")
    expect(adminGateTarget({ ...signedIn, viewer: undefined })).toBe("wait")
  })

  test("signed out goes to /login", () => {
    expect(adminGateTarget({ isLoading: false, isAuthenticated: false, viewer: undefined })).toBe("/login")
    expect(adminGateTarget({ ...signedIn, viewer: null })).toBe("/login")
  })

  test("suspended accounts see the suspended screen", () => {
    expect(adminGateTarget({ ...signedIn, viewer: viewer({ status: "suspended" }) })).toBe("suspended")
  })

  test("non-admins go to the dashboard, or get noAccess if they can't sell", () => {
    const seller = viewer({ isAdmin: false, permissions: ["ownShop.manage"] })
    expect(adminGateTarget({ ...signedIn, viewer: seller })).toBe("/dashboard")
    expect(adminGateTarget({ ...signedIn, viewer: viewer({ isAdmin: false, permissions: [] }) })).toBe("noAccess")
  })

  test("missing the page's permission goes to an allowed section (the home while none is ready)", () => {
    expect(adminGateTarget({ ...signedIn, viewer: viewer(), permission: "roles.manage" })).toBe("/admin")
  })

  test("admins with the permission see the page", () => {
    expect(adminGateTarget({ ...signedIn, viewer: viewer() })).toBe("show")
    expect(adminGateTarget({ ...signedIn, viewer: viewer(), permission: "users.view" })).toBe("show")
  })
})
