"use client"

import { useQuery } from "convex/react"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Fragment, useState } from "react"
import { api } from "../../../convex/_generated/api"
import { QueryBoundary } from "@/components/states/query-boundary"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { CountBadge, countLabel } from "./count-badge"
import { isKnownNotification, NotificationItem } from "./notification-item"
import { useMarkAllRead, useOpenNotification } from "./use-open-notification"
import { NotificationActionMenuItem } from "./notification-action"

/**
 * Top-bar bell (admin and seller): unread count, and a dropdown with the
 * latest notifications. Keyboard: Enter / Space opens, arrows move,
 * Escape closes (base-ui Menu). `allHref` is the full notifications page.
 */
export function NotificationBell({ allHref }: { allHref: string }) {
  // A failing count must never break the top bar.
  return (
    <QueryBoundary fallback={() => null}>
      <Bell allHref={allHref} />
    </QueryBoundary>
  )
}

function Bell({ allHref }: { allHref: string }) {
  const t = useTranslations("Notifications")
  const unread = useQuery(api.notifications.inbox.unreadCount, {})
  const count = unread?.count ?? 0
  const label = count > 0 ? t("bellUnread", { count: countLabel(count, unread?.capped) }) : t("bell")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative size-11" aria-label={label} />}>
        <BellIcon />
        <CountBadge count={count} capped={unread?.capped} className="absolute top-1 right-0.5 h-4 min-w-4 px-1 text-[0.6rem]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl p-0 motion-reduce:animate-none">
        <QueryBoundary fallback={(retry) => <BellError onRetry={retry} />}>
          <BellList allHref={allHref} hasUnread={count > 0} />
        </QueryBoundary>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BellList({ allHref, hasUnread }: { allHref: string; hasUnread: boolean }) {
  const t = useTranslations("Notifications")
  const router = useRouter()
  const rows = useQuery(api.notifications.inbox.latest, {})?.filter(isKnownNotification)
  const open = useOpenNotification()
  const markAllRead = useMarkAllRead()
  // Relative times are measured from when the list was opened.
  const [now] = useState(() => Date.now())

  return (
    <div className="flex flex-col">
      <p className="px-3 pt-3 pb-1 font-heading text-base font-bold">{t("title")}</p>
      <div className="max-h-[min(24rem,60dvh)] overflow-y-auto px-1">
        {rows === undefined ? (
          <div role="status" className="flex flex-col gap-3 p-3">
            <span className="sr-only">{t("title")}</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
            <CheckCheckIcon className="size-6 text-muted-foreground" aria-hidden />
            <p className="font-semibold">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
          </div>
        ) : (
          rows.map((row) => (
            <Fragment key={row._id}>
              <DropdownMenuItem className="h-auto min-h-11 items-start rounded-lg px-2" onClick={() => open(row)}>
                <NotificationItem row={row} now={now} />
              </DropdownMenuItem>
              <NotificationActionMenuItem row={row} />
            </Fragment>
          ))
        )}
      </div>
      <DropdownMenuSeparator className="mx-0 my-0" />
      <div className="flex gap-1 p-1">
        <DropdownMenuItem className="flex-1 justify-center" disabled={!hasUnread} closeOnClick={false} onClick={markAllRead}>
          {t("markAllRead")}
        </DropdownMenuItem>
        <DropdownMenuItem className="flex-1 justify-center font-semibold" onClick={() => router.push(allHref)}>
          {t("seeAll")}
        </DropdownMenuItem>
      </div>
    </div>
  )
}

function BellError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("Notifications")
  const tc = useTranslations("Common")
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <p className="text-sm text-muted-foreground">{t("error")}</p>
      <DropdownMenuItem className="justify-center" closeOnClick={false} onClick={onRetry}>
        {tc("retry")}
      </DropdownMenuItem>
    </div>
  )
}
