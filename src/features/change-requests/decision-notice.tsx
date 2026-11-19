"use client"

import { useMutation, useQuery } from "convex/react"
import { CheckCircle2Icon, XCircleIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { Button, buttonVariants } from "@/components/ui/button"
import { displayValue } from "./display-value"

/**
 * Dashboard notice: admin decisions on the seller's change requests that
 * they haven't seen yet. Dismissing marks one read. A suspended shop is
 * read-only, so it can't dismiss (the notices clear when reactivated).
 */
export function DecisionNotice({ canDismiss }: { canDismiss: boolean }) {
  const t = useTranslations("Notifications")
  const unread = useQuery(api.notifications.seller.unread, {})
  const markRead = useMutation(api.notifications.seller.markRead)
  if (!unread || unread.length === 0) return null

  return (
    <section aria-labelledby="decisions-title" className="flex flex-col gap-2">
      <h2 id="decisions-title" className="sr-only">
        {t("title")}
      </h2>
      {unread.map((n) => {
        const approved = n.kind === "changeRequest.approved"
        const Icon = approved ? CheckCircle2Icon : XCircleIcon
        return (
          <div
            key={n._id}
            role="status"
            className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm", approved ? "bg-card" : "bg-secondary")}
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", approved ? "text-success" : "text-destructive")} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-semibold break-words">
                {t(approved ? "approved" : "rejected", {
                  field: t(`field.${n.field}`),
                  value: displayValue(n.field, n.newValue),
                })}
              </p>
              {n.reason ? <p className="text-muted-foreground">{t("reason", { reason: n.reason })}</p> : null}
              <Link href="/dashboard/settings" className={buttonVariants({ variant: "link", size: "sm", className: "self-start px-0" })}>
                {t("view")}
              </Link>
            </div>
            {canDismiss ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("dismiss")}
                onClick={() => markRead({ id: n._id }).catch(() => {})}
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
