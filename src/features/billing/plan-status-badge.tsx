"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { cn } from "cn"
import { daysLeft } from "../../../convex/lib/plans"
import { badgeVariants } from "@/components/ui/badge"
import { useMyBilling, useNow } from "./use-billing"

/**
 * "Free trial: X days left" during the trial, the current plan name after.
 * Links to the Plan page. Shows nothing until billing data is available.
 */
export function PlanStatusBadge({ className }: { className?: string }) {
  const t = useTranslations("Billing")
  const tp = useTranslations("Pricing.plans")
  const billing = useMyBilling()
  const now = useNow()
  if (!billing) return null
  const trialing = billing.status === "trialing" && billing.periodEnd !== null
  const label = trialing
    ? t("trialBadge", { count: daysLeft(billing.periodEnd!, now) })
    : t("planBadge", { plan: tp(`${billing.effectivePlan}.name`) })

  return (
    <Link
      href="/dashboard/billing"
      className={cn(
        badgeVariants({ variant: trialing ? "default" : "secondary" }),
        "focus-ring hover:opacity-90",
        className,
      )}
    >
      {label}
    </Link>
  )
}
