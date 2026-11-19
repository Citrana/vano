"use client"

import { useQuery } from "convex/react"
import { CreditCardIcon, LayoutGridIcon, PaletteIcon, SettingsIcon, ShieldIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { buttonVariants } from "@/components/ui/button"
import { NotificationBell } from "@/features/notifications/notification-bell"
import { Brand } from "./brand"
import { ProfileMenu } from "./profile-menu"

/**
 * Seller top bar: section links, then the notification bell and the
 * profile menu (language, sign out). On phones the section links sit in a second row.
 */
export function SellerHeader() {
  const t = useTranslations("Seller")
  const pathname = usePathname()
  const viewer = useQuery(api.users.viewer, {})
  const links = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutGridIcon, active: pathname === "/dashboard" || pathname.startsWith("/dashboard/products") },
    { href: "/dashboard/look", label: t("look"), icon: PaletteIcon, active: pathname === "/dashboard/look" },
    { href: "/dashboard/settings", label: t("settings"), icon: SettingsIcon, active: pathname === "/dashboard/settings" },
    { href: "/dashboard/billing", label: t("billing"), icon: CreditCardIcon, active: pathname.startsWith("/dashboard/billing") },
    // Admins who also sell can switch to the admin (the server checks access).
    ...(viewer?.isAdmin ? [{ href: "/admin", label: t("admin"), icon: ShieldIcon, active: false }] : []),
  ]

  // Phones: a tab bar (icon over a short label) so five links fit in 360px.
  // Active link: a light fill only. The focus ring shows for keyboard users only.
  const nav = (mobile: boolean) => (
    <nav aria-label={t("menu")} className="flex gap-1">
      {links.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            active ? "bg-muted font-semibold text-foreground" : "text-muted-foreground",
            mobile && "h-auto min-h-11 min-w-0 flex-1 flex-col gap-0.5 px-1 py-1 text-[0.7rem] leading-tight",
          )}
        >
          <Icon />
          {/* 640–768px: icons only (labels stay for screen readers). */}
          <span className={cn(mobile ? "w-full truncate text-center" : "sr-only md:not-sr-only")}>{label}</span>
        </Link>
      ))}
    </nav>
  )

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-6">
          <Brand href="/dashboard" />
          <div className="hidden sm:block">{nav(false)}</div>
        </div>
        {viewer ? (
          <div className="flex items-center gap-1">
            <NotificationBell allHref="/dashboard/notifications" />
            <ProfileMenu email={viewer.email} />
          </div>
        ) : null}
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-2 sm:hidden">{nav(true)}</div>
    </header>
  )
}
