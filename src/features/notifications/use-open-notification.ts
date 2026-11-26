"use client"

import { useMutation, useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "../../../convex/_generated/api"
import { notificationHref } from "../../../convex/notifications/types"
import type { NotificationRow } from "./notification-item"

/**
 * Opening a notification marks it read, then goes to its page. A team
 * notification about another of the viewer's shops switches to that shop
 * first, so the page shows the right shop (CLAUDE.md "Team accounts").
 */
export function useOpenNotification(): (row: NotificationRow) => void {
  const router = useRouter()
  const markRead = useMutation(api.notifications.inbox.markRead)
  const switchShop = useMutation(api.team.switchShop)
  const viewer = useQuery(api.users.viewer, {})
  return (row) => {
    if (!row.read) markRead({ id: row._id }).catch(() => {})
    const href = notificationHref(row.data)
    if (row.shopId && viewer?.shop && row.shopId !== viewer.shop.id) {
      switchShop({ shopId: row.shopId })
        .catch(() => {})
        .finally(() => router.push(href))
    } else {
      router.push(href)
    }
  }
}

export function useMarkAllRead(): () => void {
  const markAll = useMutation(api.notifications.inbox.markAllRead)
  return () => {
    markAll({}).catch(() => {})
  }
}
