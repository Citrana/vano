"use client"

import { LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { useUpgradePlanName } from "@/features/billing/use-plan-catalog"

/** Shown instead of the stats cards on a plan without shop stats. */
export function LockedStatsCard() {
  const t = useTranslations("Billing")
  const upgradePlan = useUpgradePlanName("shopStats")
  return (
    <Card>
      <div className="flex items-center gap-2">
        <LockIcon className="size-4 text-muted-foreground" aria-hidden />
        <CardTitle>{t("lockedStatsTitle")}</CardTitle>
      </div>
      <CardDescription>{t("lockedStatsBody", { plan: upgradePlan })}</CardDescription>
      <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", className: "self-start" })}>
        {t("lockedStatsAction")}
      </Link>
    </Card>
  )
}
