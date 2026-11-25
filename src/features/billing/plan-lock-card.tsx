"use client"

import { LockIcon } from "lucide-react"
import Link from "next/link"
import type { FeatureFlag } from "../../../convex/lib/planFeatures"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUpgradePlanName } from "./use-plan-catalog"

/**
 * "Available on {plan}" + upgrade, for a page whose plan feature the shop
 * doesn't have (CLAUDE.md "Billing"). The plan name comes from the plan
 * config (the lowest plan with `feature`), never hard-coded.
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
  return (
    <Card className="gap-3">
      <p className="flex items-center gap-2 font-semibold">
        <LockIcon className="size-4" aria-hidden />
        {title(plan)}
      </p>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Link href="/dashboard/billing" className={buttonVariants({ className: "w-full sm:w-fit" })}>
        {action(plan)}
      </Link>
    </Card>
  )
}
