import type { LucideIcon } from "lucide-react"
import type { FeatureFlag } from "../../../../convex/lib/planFeatures"
import type { Permission } from "../../../../convex/lib/permissions"

/**
 * One menu entry, shared by the admin sidebar and the seller menus
 * (sidebar, bottom bar, "More" sheet). A menu is one array of these:
 * adding a page = adding one line (plus its EN/FR label).
 *
 * Hiding is not security: every Convex function checks on the server.
 */
export type NavItem<K extends string = string, G extends string = string, B extends string = string> = {
  key: K
  href: string
  icon: LucideIcon
  /** Section heading the item sits under (menus without groups omit it). */
  group?: G
  /** Shown only to users holding it (a list = any of them). */
  permission?: Permission | readonly Permission[]
  /** Plan feature the page needs: the item shows a lock without it. */
  feature?: FeatureFlag
  /** Live count shown next to the item when above zero. */
  badge?: B
  /** false until the page ships: never shown, never a redirect target. */
  ready: boolean
  /** Active only on its own address (a home page). */
  exact?: boolean
  /** Other address prefixes that also highlight this item. */
  match?: readonly string[]
  /** Phones: a bottom-bar tab. Everything else goes in the "More" sheet. */
  mobile?: "tab"
}

export type NavCount = { count: number; capped: boolean }
export type NavCounts<B extends string = string> = Partial<Record<B, NavCount | null>>

function allowed(permission: NavItem["permission"], permissions: readonly string[]): boolean {
  if (permission === undefined) return true
  const any = typeof permission === "string" ? [permission] : permission
  return any.some((p) => permissions.includes(p))
}

/** The ready items the user may open, in list order. */
export function visibleNav<T extends NavItem>(permissions: readonly string[], items: readonly T[]): T[] {
  return items.filter((item) => item.ready && allowed(item.permission, permissions))
}

/** `pathname` is `prefix` or a page under it (`/a/b` matches `/a`, not `/ab`). */
function under(prefix: string, pathname: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Whether the item is the current page. */
export function isNavActive(item: Pick<NavItem, "href" | "exact" | "match">, pathname: string): boolean {
  if (item.exact ? pathname === item.href : under(item.href, pathname)) return true
  return (item.match ?? []).some((prefix) => under(prefix, pathname))
}

/** Items split by group, in `order`; empty groups are dropped. */
export function groupNav<T extends NavItem>(
  items: readonly T[],
  order: readonly NonNullable<T["group"]>[],
): { group: NonNullable<T["group"]>; items: T[] }[] {
  return order
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0)
}

/** Phones: bottom-bar tabs and the rest (the "More" sheet). */
export function splitForMobile<T extends NavItem>(items: readonly T[]): { tabs: T[]; more: T[] } {
  return {
    tabs: items.filter((item) => item.mobile === "tab"),
    more: items.filter((item) => item.mobile !== "tab"),
  }
}

/** The item's live count when it has one above zero, else null. */
export function countFor(item: NavItem, counts: NavCounts | undefined): NavCount | null {
  const count = item.badge ? counts?.[item.badge] : null
  return count && count.count > 0 ? count : null
}
