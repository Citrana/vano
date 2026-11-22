"use client"

import { useTranslations } from "next-intl"
import { SideNav } from "@/components/shell/nav/side-nav"
import { useAttentionCounts } from "@/features/admin/attention/use-attention-counts"
import { visibleNav } from "./nav"

/** Admin sidebar links the user is allowed to open (see nav.ts), with live attention counts. */
export function AdminNav({ permissions, onNavigate }: { permissions: readonly string[]; onNavigate?: () => void }) {
  const t = useTranslations("Admin")
  const { counts } = useAttentionCounts()
  return (
    <SideNav
      items={visibleNav(permissions)}
      ariaLabel={t("menu")}
      label={(item) => t(`nav.${item.key}`)}
      counts={counts ?? undefined}
      badgeLabel={(count) => t("attention.badge", { count })}
      onNavigate={onNavigate}
    />
  )
}
