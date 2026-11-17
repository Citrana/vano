/**
 * What a seller page should do for the current visitor (CLAUDE.md
 * "Security & ownership": client-side routing only — the server is the
 * real boundary). Pure, so it's unit-tested without a browser.
 *
 * - `need="guest"`: login / signup — signed-in admins go to /admin,
 *   everyone else to the dashboard.
 * - `need="noShop"`: onboarding — sellers with a shop go to the dashboard.
 * - `need="shop"`: dashboard — no session → /login, no shop → /onboarding.
 *
 * On seller pages: a suspended account gets "suspended" (the suspended
 * screen); someone who can't sell (`ownShop.manage`) goes to /admin, or
 * gets "noAccess" if they can't use the admin either.
 */
export type GateNeed = "guest" | "noShop" | "shop"

export type GateViewer = {
  hasShop: boolean
  status: "active" | "suspended"
  isAdmin: boolean
  permissions: readonly string[]
} | null

export type GateTarget =
  | "wait"
  | "show"
  | "suspended"
  | "noAccess"
  | "/login"
  | "/dashboard"
  | "/onboarding"
  | "/admin"

export function canSell(viewer: NonNullable<GateViewer>): boolean {
  return viewer.permissions.includes("ownShop.manage")
}

export function sellerGateTarget({
  need,
  isLoading,
  isAuthenticated,
  viewer,
}: {
  need: GateNeed
  isLoading: boolean
  isAuthenticated: boolean
  /** `undefined` while the viewer query is loading. */
  viewer: GateViewer | undefined
}): GateTarget {
  if (isLoading) return "wait"
  if (!isAuthenticated) return need === "guest" ? "show" : "/login"
  if (viewer === undefined) return "wait"
  if (viewer === null) return need === "guest" ? "show" : "/login"
  if (need === "guest") return viewer.isAdmin ? "/admin" : "/dashboard"
  if (viewer.status === "suspended") return "suspended"
  if (!canSell(viewer)) return viewer.isAdmin ? "/admin" : "noAccess"
  if (need === "noShop") return viewer.hasShop ? "/dashboard" : "show"
  return viewer.hasShop ? "show" : "/onboarding"
}
