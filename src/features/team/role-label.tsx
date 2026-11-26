"use client"

import { useTranslations } from "next-intl"
import { cn } from "cn"
import type { TeamRole } from "../../../convex/lib/team"

export type ShopRole = TeamRole | "owner"

/** A role's name in the viewer's language (`TeamRoles.<role>.name`). */
export function useRoleName() {
  const t = useTranslations("TeamRoles")
  return (role: ShopRole) => t(`${role}.name`)
}

/** The role as a small plum badge (CLAUDE.md "UI": badges are plum). */
export function RoleBadge({ role, className }: { role: ShopRole; className?: string }) {
  const name = useRoleName()
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center rounded-sm bg-accent px-2 text-xs font-medium whitespace-nowrap text-accent-foreground",
        className,
      )}
    >
      {name(role)}
    </span>
  )
}
