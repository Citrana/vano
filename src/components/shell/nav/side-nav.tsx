"use client"

import { LockIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useId, type ReactNode } from "react"
import { cn } from "cn"
import { CountBadge, countLabel } from "@/features/notifications/count-badge"
import { countFor, groupNav, isNavActive, type NavCounts, type NavItem } from "./nav-model"

export type SideNavProps<T extends NavItem> = {
  /** Already filtered (`visibleNav`). */
  items: readonly T[]
  ariaLabel: string
  label: (item: T) => string
  /** With groups: items sit under headings, in this order. */
  groups?: readonly NonNullable<T["group"]>[]
  groupLabel?: (group: NonNullable<T["group"]>) => string
  counts?: NavCounts<NonNullable<T["badge"]>>
  /** Screen-reader text for a badge ("3 need attention"). */
  badgeLabel?: (count: string, item: T) => string
  /** Whether the item needs a plan feature the shop doesn't have. */
  locked?: (item: T) => boolean
  lockLabel?: (item: T) => string
  /** Icon rail: labels become tooltips (and stay for screen readers). */
  collapsed?: boolean
  onNavigate?: () => void
}

/**
 * The vertical menu used by the admin sidebar and the seller sidebar /
 * "More" sheet. It fetches nothing: the caller passes items, counts and
 * locks. The current page gets a light fill, never an outline; the outline
 * only shows for keyboard focus.
 */
export function SideNav<T extends NavItem>(props: SideNavProps<T>) {
  const { items, ariaLabel, groups, groupLabel } = props
  if (items.length === 0) return null
  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-4">
      {groups ? (
        groupNav(items, groups).map(({ group, items: groupItems }) => (
          <NavGroup key={group} title={groupLabel?.(group) ?? group} collapsed={props.collapsed}>
            {groupItems.map((item) => (
              <NavLink key={item.key} item={item} {...props} />
            ))}
          </NavGroup>
        ))
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <NavLink key={item.key} item={item} {...props} />
          ))}
        </ul>
      )}
    </nav>
  )
}

function NavGroup({ title, collapsed, children }: { title: string; collapsed?: boolean; children: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <h2
        id={id}
        className={cn(
          "px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
          // Rail: a thin rule instead of the heading (kept for screen readers).
          collapsed && "sr-only",
        )}
      >
        {title}
      </h2>
      {collapsed ? <hr aria-hidden className="mx-3 border-border" /> : null}
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  )
}

function NavLink<T extends NavItem>({
  item,
  label,
  counts,
  badgeLabel,
  locked,
  lockLabel,
  collapsed,
  onNavigate,
}: SideNavProps<T> & { item: T }) {
  const pathname = usePathname()
  const active = isNavActive(item, pathname)
  const text = label(item)
  const count = countFor(item, counts)
  const isLocked = locked?.(item) ?? false
  const Icon = item.icon

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? text : undefined}
        className={cn(
          "focus-ring relative flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:min-h-9 [&_svg]:size-4 [&_svg]:shrink-0",
          active && "bg-secondary font-semibold text-foreground hover:bg-secondary",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon aria-hidden />
        <span className={cn("flex-1 truncate text-left", collapsed && "sr-only")}>{text}</span>
        {count ? (
          <>
            {collapsed ? (
              <span aria-hidden className="absolute top-1.5 right-2 size-2 rounded-full bg-plum" />
            ) : (
              <CountBadge count={count.count} capped={count.capped} />
            )}
            {badgeLabel ? (
              <span className="sr-only">{badgeLabel(countLabel(count.count, count.capped), item)}</span>
            ) : null}
          </>
        ) : null}
        {isLocked ? (
          <>
            <LockIcon
              aria-hidden
              className={cn("text-muted-foreground", collapsed && "absolute right-1.5 bottom-1.5 size-3!")}
            />
            {lockLabel ? <span className="sr-only">{lockLabel(item)}</span> : null}
          </>
        ) : null}
      </Link>
    </li>
  )
}
