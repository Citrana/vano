"use client"

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CreditCardIcon,
  FilePenLineIcon,
  PaletteIcon,
  ShieldAlertIcon,
  PauseCircleIcon,
  SparklesIcon,
  TagIcon,
  TicketPercentIcon,
  Trash2Icon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { cn } from "cn"
import type { FunctionReturnType } from "convex/server"
import type { api } from "../../../convex/_generated/api"
import type { NotificationType } from "../../../convex/notifications/types"
import { useNotificationText } from "./use-notification-text"

/** One icon per type (CLAUDE.md "Notifications": add one with every new type). */
const ICONS: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  "changeRequest.submitted": { icon: FilePenLineIcon, tone: "text-muted-foreground" },
  "changeRequest.flagged": { icon: ShieldAlertIcon, tone: "text-destructive" },
  "changeRequest.approved": { icon: CheckCircle2Icon, tone: "text-success" },
  "changeRequest.rejected": { icon: XCircleIcon, tone: "text-destructive" },
  "payment.failed": { icon: AlertTriangleIcon, tone: "text-destructive" },
  "admin.paymentFailed": { icon: AlertTriangleIcon, tone: "text-destructive" },
  "plan.activated": { icon: SparklesIcon, tone: "text-success" },
  "plan.expired": { icon: CreditCardIcon, tone: "text-muted-foreground" },
  "plan.endingSoon": { icon: ClockIcon, tone: "text-muted-foreground" },
  "plan.inGrace": { icon: ClockIcon, tone: "text-muted-foreground" },
  "plan.trialProOnly": { icon: CreditCardIcon, tone: "text-muted-foreground" },
  "admin.endingSoon": { icon: ClockIcon, tone: "text-muted-foreground" },
  "look.reset": { icon: PaletteIcon, tone: "text-destructive" },
  "sale.started": { icon: TagIcon, tone: "text-success" },
  "sale.endingSoon": { icon: ClockIcon, tone: "text-muted-foreground" },
  "sale.ended": { icon: TagIcon, tone: "text-muted-foreground" },
  "sale.adminPaused": { icon: PauseCircleIcon, tone: "text-destructive" },
  "sale.adminDeleted": { icon: Trash2Icon, tone: "text-destructive" },
  "discountCode.adminPaused": { icon: TicketPercentIcon, tone: "text-destructive" },
  "discountCode.adminDeleted": { icon: Trash2Icon, tone: "text-destructive" },
}

export type NotificationRow = FunctionReturnType<typeof api.notifications.inbox.latest>[number]

/**
 * Whether this client knows how to show the row. A row written by newer
 * server code (a type this build doesn't have yet) is skipped instead of
 * breaking the whole list.
 */
export function isKnownNotification(row: NotificationRow): boolean {
  return Object.hasOwn(ICONS, row.data.type)
}

/**
 * The inside of a notification row: icon, text, time and the unread
 * marker. Unread doesn't rely on color: a dot, bold text and a
 * screen-reader "Unread".
 */
export function NotificationItem({ row, now }: { row: NotificationRow; now: number }) {
  const t = useTranslations("Notifications")
  const format = useFormatter()
  const text = useNotificationText()
  const { icon: Icon, tone } = ICONS[row.data.type]
  return (
    <span className="flex w-full items-start gap-3 py-2 text-left">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className={cn("size-4", tone)} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm break-words whitespace-normal", row.read ? "text-muted-foreground" : "font-semibold text-foreground")}>
          {!row.read ? <span className="sr-only">{t("unread")}: </span> : null}
          {text(row.data, now)}
        </span>
        <time dateTime={new Date(row._creationTime).toISOString()} className="text-xs text-muted-foreground">
          {format.relativeTime(new Date(row._creationTime), now)}
        </time>
      </span>
      {!row.read ? <span aria-hidden className="mt-2 size-2.5 shrink-0 rounded-full bg-plum" /> : null}
    </span>
  )
}
