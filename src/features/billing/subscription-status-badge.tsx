"use client"

import { useTranslations } from "next-intl"
import type { SubscriptionStatus } from "../../../convex/lib/plans"
import { Badge } from "@/components/ui/badge"

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const t = useTranslations("Billing.status")
  return <Badge variant={status === "trialing" || status === "active" ? "default" : "muted"}>{t(status)}</Badge>
}
