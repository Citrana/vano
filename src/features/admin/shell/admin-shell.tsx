"use client"

import { MenuIcon, StoreIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import { Brand } from "@/components/shell/brand"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SignOutButton } from "@/features/auth/sign-out-button"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"
import { NotificationBell } from "@/features/notifications/notification-bell"
import { AdminNav } from "./admin-nav"
import { ADMIN_HOME } from "./nav"
import { useAdminViewer, useRoleLabel } from "./use-admin-viewer"

/**
 * Admin frame: fixed sidebar from `md`, a menu button + left drawer on
 * phones. Rendered inside AdminGate, so the viewer is a signed-in admin.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Admin")
  const { viewer } = useAdminViewer()
  const roleLabel = useRoleLabel()
  const [menuOpen, setMenuOpen] = useState(false)
  if (!viewer) return null
  const permissions = viewer.permissions
  const canSell = permissions.includes("ownShop.manage")

  const brand = (
    <div className="flex items-baseline gap-2">
      <Brand href={ADMIN_HOME} />
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("title")}</span>
    </div>
  )

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-card px-3 py-4 md:flex">
        <div className="px-2">{brand}</div>
        <AdminNav permissions={permissions} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-2 px-4">
            <div className="flex items-center gap-2 md:hidden">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger render={<Button variant="ghost" size="icon" />}>
                  <MenuIcon />
                  <span className="sr-only">{t("openMenu")}</span>
                </SheetTrigger>
                <SheetContent>
                  <SheetTitle>{brand}</SheetTitle>
                  <AdminNav permissions={permissions} onNavigate={() => setMenuOpen(false)} />
                </SheetContent>
              </Sheet>
              {brand}
            </div>
            <p className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">
              {viewer.email} · {roleLabel(viewer)}
            </p>
            <div className="flex items-center gap-1">
              {canSell ? (
                <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
                  <StoreIcon />
                  <span className="hidden sm:inline">{t("myShop")}</span>
                  <span className="sr-only sm:hidden">{t("myShop")}</span>
                </Link>
              ) : null}
              <NotificationBell allHref="/admin/notifications" />
              <LanguageSwitcher />
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-12">{children}</main>
      </div>
    </div>
  )
}
