import { invitePath, isInviteToken } from "../../../convex/lib/team"

/**
 * Where to go after signing in / up, from the link's `?next=` (e.g. a team
 * invite, CLAUDE.md "Team accounts"). Only an internal path is accepted:
 * one leading "/", no "//" or "\" (another site), no scheme, bounded.
 * Anything else is ignored. Pure, so server pages can call it.
 */
export function nextParam(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string" || value.length > 200) return undefined
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined
  if (/[\s:]/.test(value)) return undefined
  return value
}

/** The invite token in a `next` path (`/join/<token>`), if any: sent with a sign-up. */
export function inviteFromNext(next: string | undefined): string | undefined {
  const token = next?.startsWith("/join/") ? next.slice("/join/".length) : undefined
  return token !== undefined && isInviteToken(token) && invitePath(token) === next ? token : undefined
}

/** `/login?next=…` / `/signup?next=…`. */
export function withNext(path: "/login" | "/signup", next: string | undefined): string {
  return next ? `${path}?${new URLSearchParams({ next })}` : path
}
