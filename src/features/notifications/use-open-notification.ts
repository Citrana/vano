"use client"

import { useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "../../../convex/_generated/api"
import { notificationHref } from "../../../convex/notifications/types"
import type { NotificationRow } from "./notification-item"

/** Opening a notification marks it read, then goes to its page. */
export function useOpenNotification(): (row: NotificationRow) => void {
  const router = useRouter()
  const markRead = useMutation(api.notifications.inbox.markRead)
  return (row) => {
    if (!row.read) markRead({ id: row._id }).catch(() => {})
    router.push(notificationHref(row.data))
  }
}

export function useMarkAllRead(): () => void {
  const markAll = useMutation(api.notifications.inbox.markAllRead)
  return () => {
    markAll({}).catch(() => {})
  }
}
