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
import { buttonVariants } from "@/components/ui/button"
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

/** Sidebar links the user is allowed to open (see nav.ts). */
export function AdminNav({ permissions, onNavigate }: { permissions: readonly string[]; onNavigate?: () => void }) {
  const t = useTranslations("Admin")
  const pathname = usePathname()
  const items = visibleNav(permissions)
  if (items.length === 0) return null
  return (
    <nav aria-label={t("menu")} className="flex flex-col gap-1">
      {items.map(({ key, href }) => {
        const Icon = ICONS[key]
        const active = isActive(href, pathname)
        return (
          <Link
            key={key}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(buttonVariants({ variant: active ? "secondary" : "ghost" }), "justify-start")}
          >
            <Icon />
            {t(`nav.${key}`)}
          </Link>
        )
      })}
    </nav>
  )
}
