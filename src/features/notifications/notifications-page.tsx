"use client"

import { usePaginatedQuery, useQuery } from "convex/react"
import { BellIcon, Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "../../../convex/notifications/types"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, ErrorState, LoadingState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { NotificationItem } from "./notification-item"
import { useMarkAllRead, useOpenNotification } from "./use-open-notification"

const PAGE_SIZE = 20

/** The full notifications page (admin and seller): filters + paginated list. */
export function NotificationsPage({ backHref }: { backHref?: string }) {
  const t = useTranslations("Notifications")
  const tc = useTranslations("Common")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [category, setCategory] = useState<"" | NotificationCategory>("")
  const unread = useQuery(api.notifications.inbox.unreadCount, {})
  const markAllRead = useMarkAllRead()

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageTitle
        title={t("title")}
        backHref={backHref}
        backLabel={backHref ? tc("back") : undefined}
        action={
          <Button variant="outline" disabled={!unread || unread.count === 0} onClick={markAllRead}>
            {t("markAllRead")}
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("filterLabel")} className="flex gap-2">
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={unreadOnly === value}
              onClick={() => setUnreadOnly(value)}
              className={cn(
                "focus-ring min-h-11 rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none",
                unreadOnly === value ? "chip-selected" : "bg-card hover:bg-muted",
              )}
            >
              {value ? t("filterUnread") : t("filterAll")}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="sr-only">{t("categoryLabel")}</span>
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value as "" | NotificationCategory)}>
            <option value="">{t("categories.all")}</option>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <QueryBoundary key={`${unreadOnly}-${category}`} fallback={(retry) => <ErrorState onRetry={retry} />}>
        <NotificationList unreadOnly={unreadOnly} category={category || undefined} />
      </QueryBoundary>
    </div>
  )
}

function NotificationList({ unreadOnly, category }: { unreadOnly: boolean; category?: NotificationCategory }) {
  const t = useTranslations("Notifications")
  const open = useOpenNotification()
  const [now] = useState(() => Date.now())
  const { results, status, loadMore } = usePaginatedQuery(
    api.notifications.inbox.list,
    { unreadOnly: unreadOnly || undefined, category },
    { initialNumItems: PAGE_SIZE },
  )

  if (status === "LoadingFirstPage") return <LoadingState />
  if (results.length === 0 && status === "Exhausted") {
    return (
      <EmptyState
        icon={<BellIcon />}
        title={t("emptyTitle")}
        body={unreadOnly ? t("emptyUnreadBody") : t("emptyBody")}
      />
    )
  }
  return (
    <>
      <ul className="flex flex-col gap-2">
        {results.map((row) => (
          <li key={row._id}>
            <button
              type="button"
              onClick={() => open(row)}
              className={cn(
                "focus-ring flex min-h-11 w-full rounded-xl border px-3 text-left hover:bg-muted md:px-4",
                row.read ? "bg-background" : "bg-card",
              )}
            >
              <NotificationItem row={row} now={now} />
            </button>
          </li>
        ))}
      </ul>
      {status !== "Exhausted" ? (
        <Button variant="outline" className="self-center" disabled={status === "LoadingMore"} onClick={() => loadMore(PAGE_SIZE)}>
          {status === "LoadingMore" ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}
          {t("loadMore")}
        </Button>
      ) : null}
    </>
  )
}
