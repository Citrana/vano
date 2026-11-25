"use client"

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { cn } from "cn"
import { Brand } from "@/components/shell/brand"
import { SideNav } from "@/components/shell/nav/side-nav"
import { ProfileMenu } from "@/components/shell/profile-menu"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/features/notifications/notification-bell"
import { SellerBottomBar } from "./seller-bottom-bar"
import { SELLER_HOME, SELLER_NAV_GROUPS } from "./seller-nav"
import { useSellerNav, useSidebarCollapsed } from "./use-seller-nav"

/**
 * Seller frame. Top bar: logo, bell, avatar menu (admin, language, sign
 * out). From `md`: a grouped, collapsible left sidebar. Phones: a bottom
 * bar + "More" sheet. All three menus come from `SELLER_NAV`.
 *
 * `--bottom-bar` is the bottom bar's height (0 from `md`): sticky footers
 * and the page's bottom padding use it so nothing hides under the bar.
 */
export function SellerShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Seller")
  const nav = useSellerNav()
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  const { viewer } = nav

  return (
    <div className="flex flex-1 flex-col [--bottom-bar:calc(4rem+env(safe-area-inset-bottom))] md:[--bottom-bar:0px]">
      <header data-print-hide className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Brand href={SELLER_HOME} />
          {viewer ? (
            <div className="flex items-center gap-1">
              <NotificationBell allHref="/dashboard/notifications" />
              <ProfileMenu email={viewer.email} isAdmin={viewer.isAdmin} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          id="seller-sidebar"
          data-print-hide
          className={cn(
            "sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col justify-between gap-4 overflow-y-auto border-r bg-card py-4 md:flex",
            collapsed ? "w-16 px-2" : "w-60 px-3",
          )}
        >
          <SideNav
            items={nav.items}
            ariaLabel={t("menu")}
            groups={SELLER_NAV_GROUPS}
            groupLabel={nav.groupLabel}
            label={nav.label}
            counts={nav.counts}
            badgeLabel={(count) => t("badge", { count })}
            locked={nav.locked}
            lockLabel={nav.lockLabel}
            collapsed={collapsed}
          />
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className={cn("text-muted-foreground", collapsed ? "self-center" : "justify-start")}
            aria-controls="seller-sidebar"
            aria-expanded={!collapsed}
            title={collapsed ? t("expand") : undefined}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
            <span className={cn(collapsed && "sr-only")}>{collapsed ? t("expand") : t("collapse")}</span>
          </Button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>

      <SellerBottomBar nav={nav} />
    </div>
  )
}
