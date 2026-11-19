"use client"

import { LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import type { FeatureFlag } from "../../../../convex/lib/planFeatures"
import { useUpgradePlanName } from "@/features/billing/use-plan-catalog"

/** "Available on <plan> · See plans" under options the seller's plan doesn't include. */
export function ProNote({ feature = "allLooks" }: { feature?: FeatureFlag }) {
  const t = useTranslations("LookEditor.lock")
  const plan = useUpgradePlanName(feature)
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <LockIcon className="size-3.5" aria-hidden />
      {t("availableOn", { plan })}
      <Link href="/dashboard/billing" className="font-medium text-foreground underline underline-offset-4">
        {t("link")}
      </Link>
    </p>
  )
}
