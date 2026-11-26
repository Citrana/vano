"use client"

import { useQuery } from "convex/react"
import { LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../convex/_generated/api"
import type { FeatureFlag } from "../../../convex/lib/planFeatures"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUpgradePlanName } from "./use-plan-catalog"

/**
 * "Available on {plan}" + upgrade, for a page whose plan feature the shop
 * doesn't have (CLAUDE.md "Billing"). The plan name comes from the plan
 * config (the lowest plan with `feature`), never hard-coded. A team member
 * who can't manage the plan is asked to tell the owner instead (CLAUDE.md
 * "Team accounts").
 */
export function PlanLockCard({
  feature,
  title,
  body,
  action,
}: {
  feature: FeatureFlag
  title: (plan: string) => string
  body: string
  action: (plan: string) => string
}) {
  const plan = useUpgradePlanName(feature)
  const t = useTranslations("Team")
  const viewer = useQuery(api.users.viewer, {})
  const canUpgrade = viewer?.permissions.includes("ownBilling.manage") ?? true
  return (
    <Card className="gap-3">
      <p className="flex items-center gap-2 font-semibold">
        <LockIcon className="size-4" aria-hidden />
        {title(plan)}
      </p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {canUpgrade ? (
        <Link href="/dashboard/billing" className={buttonVariants({ className: "w-full sm:w-fit" })}>
          {action(plan)}
        </Link>
      ) : (
        <p className="text-sm font-medium">{t("askOwner", { plan })}</p>
      )}
    </Card>
  )
}
