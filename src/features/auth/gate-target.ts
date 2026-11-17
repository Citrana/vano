/**
 * What a seller page should do for the current visitor (CLAUDE.md
 * "Security & ownership": client-side routing only — the server is the
 * real boundary). Pure, so it's unit-tested without a browser.
 *
 * - `need="guest"`: login / signup — signed-in users go to the dashboard.
 * - `need="noShop"`: onboarding — sellers with a shop go to the dashboard.
 * - `need="shop"`: dashboard — no session → /login, no shop → /onboarding.
 *
 * A suspended account gets "suspended" on onboarding / dashboard pages
 * (the suspended screen). On login / signup it is still sent to the
 * dashboard, which then shows that screen.
 */
export type GateNeed = "guest" | "noShop" | "shop"

export type GateViewer = {
  hasShop: boolean
  status: "active" | "suspended"
} | null

export type GateTarget = "wait" | "show" | "suspended" | "/login" | "/dashboard" | "/onboarding"

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
  if (need === "guest") return "/dashboard"
  if (viewer.status === "suspended") return "suspended"
  if (need === "noShop") return viewer.hasShop ? "/dashboard" : "show"
  return viewer.hasShop ? "show" : "/onboarding"
}
