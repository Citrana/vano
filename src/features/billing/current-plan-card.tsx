"use client"

import { EyeOffIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { daysLeft } from "../../../convex/lib/plans"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { SubscriptionStatusBadge } from "./subscription-status-badge"
import type { MyBilling } from "./use-billing"
import { usePlanName } from "@/features/billing/use-plan-catalog"

/** Plan, status, end date / days left, and usage against the plan's limits. */
export function CurrentPlanCard({ billing, now }: { billing: MyBilling; now: number }) {
  const t = useTranslations("Billing")
  const planName = usePlanName()
  const format = useFormatter()
  const { status, periodEnd, limits, usage } = billing
  const running = (status === "trialing" || status === "active") && periodEnd !== null
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "long" })

  return (
    <Card aria-labelledby="current-plan-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("currentPlan")}</p>
          <CardTitle id="current-plan-title" className="text-2xl">
            {planName(billing.effectivePlan)}
          </CardTitle>
        </div>
        <SubscriptionStatusBadge status={status} />
      </div>

      {running ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p>{status === "trialing" ? t("trialEnds", { date: date(periodEnd) }) : t("activeUntil", { date: date(periodEnd) })}</p>
          <p className="font-semibold tabular-nums">{t("daysLeft", { count: daysLeft(periodEnd, now) })}</p>
        </div>
      ) : (
        <p className="text-muted-foreground">{status === "expired" ? t("expiredNote") : t("freeNote")}</p>
      )}
      {status === "active" ? <p className="text-xs text-muted-foreground">{t("noAutoRenew")}</p> : null}

      <dl className="grid grid-cols-2 gap-3 border-t pt-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{t("usageProducts")}</dt>
          <dd className="font-semibold tabular-nums">
            {limits.products === null
              ? t("usageUnlimited", { used: usage.products })
              : t("usageOf", { used: usage.products, limit: limits.products })}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{t("photosPerProduct")}</dt>
          <dd className="font-semibold tabular-nums">{limits.photosPerProduct}</dd>
        </div>
      </dl>

      {usage.overLimit > 0 ? (
        <div role="status" className="flex flex-col gap-2 rounded-lg bg-secondary p-3">
          <p className="flex items-start gap-2">
            <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("overLimit", { count: usage.overLimit })}
          </p>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}>
            {t("manageProducts")}
          </Link>
        </div>
      ) : null}
    </Card>
  )
}
