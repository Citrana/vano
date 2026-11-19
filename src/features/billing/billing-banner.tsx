"use client"

import { ClockIcon, InfoIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"
import { EXPIRY_WARNING_DAYS, daysLeft } from "../../../convex/lib/plans"
import { Button, buttonVariants } from "@/components/ui/button"
import { useMyBilling, useNow } from "./use-billing"
import { usePlanName } from "@/features/billing/use-plan-catalog"

const DISMISS_KEY = "vano.billing.freeNoticeDismissed"

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

/**
 * Strip under the seller header: a warning in the last days of a trial or
 * plan, and a one-time notice after moving to Free (dismissed per period,
 * remembered in this browser only).
 */
export function BillingBanner() {
  const t = useTranslations("Billing")
  const planName = usePlanName()
  const billing = useMyBilling()
  const now = useNow()
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readDismissed(),
  )
  if (!billing) return null
  const onBillingPage = pathname.startsWith("/dashboard/billing")
  const { status, periodEnd, periodStart } = billing

  if ((status === "trialing" || status === "active") && periodEnd !== null) {
    const left = daysLeft(periodEnd, now)
    if (left > EXPIRY_WARNING_DAYS) return null
    const plan = planName(billing.plan)
    return (
      <Strip
        icon={<ClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
        text={status === "trialing" ? t("bannerTrialEnding", { count: left, plan }) : t("bannerPlanEnding", { count: left, plan })}
        actions={
          onBillingPage ? null : (
            <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("bannerAction")}
            </Link>
          )
        }
      />
    )
  }

  const key = String(periodStart)
  if (dismissed === key) return null
  function dismiss() {
    setDismissed(key)
    try {
      window.localStorage.setItem(DISMISS_KEY, key)
    } catch {
      // Storage blocked: the notice just comes back next visit.
    }
  }
  return (
    <Strip
      icon={<InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      text={t("bannerFree")}
      actions={
        <>
          {onBillingPage ? null : (
            <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("bannerAction")}
            </Link>
          )}
          <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label={t("dismiss")}>
            <XIcon />
          </Button>
        </>
      }
    />
  )
}

function Strip({ icon, text, actions }: { icon: ReactNode; text: string; actions: ReactNode }) {
  return (
    <div role="status" className="border-b bg-secondary">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm">
        <p className="flex flex-1 basis-56 items-start gap-2">
          {icon}
          {text}
        </p>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </div>
    </div>
  )
}
