/**
 * What a seller page should do for the current visitor (CLAUDE.md
 * "Security & ownership": client-side routing only — the server is the
 * real boundary). Pure, so it's unit-tested without a browser.
 *
 * - `need="guest"`: login / signup — signed-in people go to `next` (a
 *   safe internal path, e.g. a team invite), else admins to /admin and
 *   everyone else to the dashboard.
 * - `need="noShop"`: onboarding — people who OWN a shop go to the
 *   dashboard (a team member may still open their own).
 * - `need="shop"`: dashboard — no session → /login; no usable shop →
 *   "memberPaused" when they belong to shops that are paused or suspended
 *   for them (CLAUDE.md "Team accounts"), else /onboarding.
 *
 * On seller pages: a suspended account gets "suspended" (the suspended
 * screen); someone who can't sell (`ownShop.view`) goes to /admin, or
 * gets "noAccess" if they can't use the admin either.
 */
export type GateNeed = "guest" | "noShop" | "shop"

export type GateViewer = {
  hasShop: boolean
  /** Owns a shop (defaults to `hasShop` when unknown). */
  ownsShop?: boolean
  status: "active" | "suspended"
  isAdmin: boolean
  permissions: readonly string[]
  /** Shops they own or belong to (only the roles matter here). */
  shops?: readonly { role: string }[]
} | null

export type GateTarget =
  | "wait"
  | "show"
  | "suspended"
  | "noAccess"
  | "memberPaused"
  | "/login"
  | "/dashboard"
  | "/onboarding"
  | "/admin"
  | `/${string}`

export function canSell(viewer: NonNullable<GateViewer>): boolean {
  return viewer.permissions.includes("ownShop.view")
}

export function sellerGateTarget({
  need,
  isLoading,
  isAuthenticated,
  viewer,
  next,
}: {
  need: GateNeed
  isLoading: boolean
  isAuthenticated: boolean
  /** `undefined` while the viewer query is loading. */
  viewer: GateViewer | undefined
  /** Guest pages: where to go once signed in (already checked by `nextParam`). */
  next?: string
}): GateTarget {
  if (isLoading) return "wait"
  if (!isAuthenticated) return need === "guest" ? "show" : "/login"
  if (viewer === undefined) return "wait"
  if (viewer === null) return need === "guest" ? "show" : "/login"
  if (need === "guest") return (next as `/${string}` | undefined) ?? (viewer.isAdmin ? "/admin" : "/dashboard")
  if (viewer.status === "suspended") return "suspended"
  if (!canSell(viewer)) return viewer.isAdmin ? "/admin" : "noAccess"
  if (need === "noShop") return (viewer.ownsShop ?? viewer.hasShop) ? "/dashboard" : "show"
  if (viewer.hasShop) return "show"
  return (viewer.shops ?? []).some((s) => s.role !== "owner") ? "memberPaused" : "/onboarding"
}
