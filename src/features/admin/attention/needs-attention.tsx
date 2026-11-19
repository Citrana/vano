"use client"

import { AlertTriangleIcon, CheckIcon, ClockIcon, FilePenLineIcon, ShieldAlertIcon, type LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"
import { countLabel } from "@/features/notifications/count-badge"
import { attentionHref, type AttentionCard } from "./links"
import { useAttentionCounts } from "./use-attention-counts"

const CARDS: readonly { key: AttentionCard; icon: LucideIcon }[] = [
  { key: "pendingChangeRequests", icon: FilePenLineIcon },
  { key: "flaggedChangeRequests", icon: ShieldAlertIcon },
  { key: "failedPayments", icon: AlertTriangleIcon },
  { key: "endingSoon", icon: ClockIcon },
]

/**
 * Admin dashboard "Needs attention": live counts from the real tables.
 * Each card opens its list with the filter applied. Cards the viewer may
 * not see (null count) are left out.
 */
export function NeedsAttention() {
  const t = useTranslations("Admin.attention")
  const { now, counts } = useAttentionCounts()
  const visible = counts ? CARDS.filter(({ key }) => counts[key] !== null) : CARDS
  if (counts && visible.length === 0) return null

  return (
    <section aria-labelledby="attention-title" className="flex flex-col gap-3">
      <h2 id="attention-title" className="font-heading text-lg font-bold tracking-tight">
        {t("title")}
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {visible.map(({ key, icon: Icon }) => {
          const value = counts?.[key]
          const busy = value !== undefined && value !== null && value.count > 0
          return (
            <li key={key}>
              <Link
                href={attentionHref(key, now)}
                className="focus-ring flex h-full min-h-28 flex-col justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted motion-reduce:transition-none"
              >
                <span className="flex items-center justify-between gap-2">
                  <Icon className={cn("size-5", busy ? "text-destructive" : "text-muted-foreground")} aria-hidden />
                  {value && !busy ? <CheckIcon className="size-4 text-success" aria-hidden /> : null}
                </span>
                <span className="flex flex-col gap-0.5">
                  {value === undefined ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <span className={cn("font-heading text-3xl font-bold tabular-nums", !busy && "text-muted-foreground")}>
                      {value ? countLabel(value.count, value.capped) : 0}
                    </span>
                  )}
                  <span className="text-sm leading-snug text-muted-foreground">{t(key)}</span>
                  {value && !busy ? <span className="sr-only">{t("allClear")}</span> : null}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
