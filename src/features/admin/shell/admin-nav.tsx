"use client"

import {
  CreditCardIcon,
  FilePenLineIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StoreIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import { useAttentionCounts } from "@/features/admin/attention/use-attention-counts"
import { CountBadge, countLabel } from "@/features/notifications/count-badge"
import { isActive, visibleNav, type AdminNavKey } from "./nav"

const ICONS: Record<AdminNavKey, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  users: UsersIcon,
  shops: StoreIcon,
  changeRequests: FilePenLineIcon,
  products: PackageIcon,
  subscriptions: CreditCardIcon,
  payments: ReceiptIcon,
  roles: ShieldCheckIcon,
  activity: HistoryIcon,
  settings: SettingsIcon,
}

/**
 * Sidebar links the user is allowed to open (see nav.ts), with live
 * attention counts. The current page gets a light fill, never an outline;
 * the outline only shows for keyboard focus.
 */
export function AdminNav({ permissions, onNavigate }: { permissions: readonly string[]; onNavigate?: () => void }) {
  const t = useTranslations("Admin")
  const pathname = usePathname()
  const { counts } = useAttentionCounts()
  const items = visibleNav(permissions)
  if (items.length === 0) return null
  return (
    <nav aria-label={t("menu")} className="flex flex-col gap-1">
      {items.map(({ key, href, attention }) => {
        const Icon = ICONS[key]
        const active = isActive(href, pathname)
        const count = attention ? counts?.[attention] : null
        return (
          <Link
            key={key}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:min-h-9 [&_svg]:size-4 [&_svg]:shrink-0",
              active && "bg-secondary font-semibold text-foreground hover:bg-secondary",
            )}
          >
            <Icon />
            <span className="flex-1 truncate text-left">{t(`nav.${key}`)}</span>
            {count && count.count > 0 ? (
              <>
                <CountBadge count={count.count} capped={count.capped} />
                <span className="sr-only">{t("attention.badge", { count: countLabel(count.count, count.capped) })}</span>
              </>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
