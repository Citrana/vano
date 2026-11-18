"use client"

import { useTranslations } from "next-intl"
import type { PaymentStatus } from "../../../convex/payments/types"
import { Badge } from "@/components/ui/badge"

const VARIANT: Record<PaymentStatus, "default" | "secondary" | "muted" | "destructive"> = {
  created: "muted",
  pending: "secondary",
  succeeded: "default",
  failed: "destructive",
  cancelled: "muted",
  expired: "muted",
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations("Billing.paymentStatus")
  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>
}
