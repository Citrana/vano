"use client"

import { EllipsisIcon, LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, useState, type ReactNode } from "react"
import { cn } from "cn"
import { countFor, isNavActive, splitForMobile } from "@/components/shell/nav/nav-model"
import { SideNav } from "@/components/shell/nav/side-nav"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { CountBadge, countLabel } from "@/features/notifications/count-badge"
import { SELLER_NAV_GROUPS, type SellerNavItem } from "./seller-nav"
import type { useSellerNav } from "./use-seller-nav"

const tabClass = (active: boolean) =>
  cn(
    "focus-ring flex h-full min-h-14 w-full flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.7rem] leading-tight font-medium text-muted-foreground",
    active && "font-semibold text-foreground",
  )

/** Icon with a soft fill when active, plus an optional corner mark (lock, badge). */
function TabIcon({ active, children, mark }: { active: boolean; children: ReactNode; mark?: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn("relative flex h-7 w-12 items-center justify-center rounded-md [&>svg]:size-5", active && "bg-secondary")}
    >
      {children}
      {mark}
    </span>
  )
}

/**
 * Phones (below `md`): the `mobile: "tab"` items as a fixed bottom bar,
 * plus "More", a bottom sheet with every other item. Sits above the
 * phone's bottom edge (safe area); pages reserve `--bottom-bar`.
 */
export function SellerBottomBar({ nav }: { nav: ReturnType<typeof useSellerNav> }) {
  const t = useTranslations("Seller")
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  const { tabs, more } = splitForMobile(nav.items)
  if (nav.items.length === 0) return null
  const moreActive = more.some((item) => isNavActive(item, pathname))
  const moreHasCount = more.some((item) => countFor(item, nav.counts) !== null)

  const tab = (item: SellerNavItem) => {
    const active = isNavActive(item, pathname)
    const locked = nav.locked(item)
    const count = countFor(item, nav.counts)
    return (
      <li key={item.key} className="min-w-0 flex-1">
        <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
          <TabIcon
            active={active}
            mark={
              count ? (
                <CountBadge count={count.count} capped={count.capped} className="absolute -top-1 right-0" />
              ) : locked ? (
                <LockIcon className="absolute -top-0.5 right-1.5 size-3! text-muted-foreground" />
              ) : null
            }
          >
            <item.icon />
          </TabIcon>
          <span className="w-full truncate text-center">{nav.label(item)}</span>
          {locked ? <span className="sr-only">{nav.lockLabel(item)}</span> : null}
          {count ? (
            <span className="sr-only">{t("badge", { count: countLabel(count.count, count.capped) })}</span>
          ) : null}
        </Link>
      </li>
    )
  }

  return (
    <nav
      data-print-hide
      aria-label={t("menu")}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex h-16 items-stretch gap-1 px-2 py-1">
        {tabs.map(tab)}
        {more.length > 0 ? (
          <li className="min-w-0 flex-1">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger className={tabClass(moreActive || open)} aria-current={moreActive ? "page" : undefined}>
                <TabIcon
                  active={moreActive || open}
                  mark={moreHasCount ? <span className="absolute top-0 right-2 size-2 rounded-full bg-plum" /> : null}
                >
                  <EllipsisIcon />
                </TabIcon>
                <span className="w-full truncate text-center">{t("nav.more")}</span>
              </SheetTrigger>
              {/* Opened by tap: focus the title, not the first link (no stray focus ring). */}
              <SheetContent
                side="bottom"
                className="overflow-y-auto"
                initialFocus={(type) => (type === "keyboard" ? true : title.current)}
              >
                <SheetTitle ref={title} tabIndex={-1} className="outline-none">
                  {t("moreTitle")}
                </SheetTitle>
                <SideNav
                  items={more}
                  ariaLabel={t("moreTitle")}
                  groups={SELLER_NAV_GROUPS}
                  groupLabel={nav.groupLabel}
                  label={nav.label}
                  counts={nav.counts}
                  badgeLabel={(count) => t("badge", { count })}
                  locked={nav.locked}
                  lockLabel={nav.lockLabel}
                  onNavigate={() => setOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
