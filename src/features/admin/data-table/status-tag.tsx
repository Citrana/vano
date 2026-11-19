"use client"

import { useTranslations } from "next-intl"
import { cn } from "cn"
import { statusTone, type StatusKind, type StatusOf, type StatusTone } from "./status-tones"

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-tag-success text-tag-success-foreground",
  warning: "bg-tag-warning text-tag-warning-foreground",
  danger: "bg-tag-danger text-tag-danger-foreground",
  info: "bg-accent text-accent-foreground",
  muted: "bg-muted text-muted-foreground",
}

/** Where each kind's labels live in the messages (existing namespaces). */
const NAMESPACE = {
  change: "ChangeRequests.status",
  payment: "Billing.paymentStatus",
  subscription: "Billing.status",
  user: "UserStatus",
  shop: "ShopStatus",
  visibility: "AdminProducts",
} as const

/** A small status tag; the same status always has the same color on every admin page. */
export function StatusTag<K extends StatusKind>({ kind, status, className }: { kind: K; status: StatusOf<K>; className?: string }) {
  // Each kind reads its own namespace; the status is always one of its keys.
  const t = useTranslations(NAMESPACE[kind]) as unknown as (key: string) => string
  return (
    <span
      data-tone={statusTone(kind, status)}
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[statusTone(kind, status)],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(status)}
    </span>
  )
}
