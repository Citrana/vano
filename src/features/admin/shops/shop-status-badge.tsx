"use client"

import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"

export function ShopStatusBadge({ status }: { status: "active" | "suspended" }) {
  const t = useTranslations("ShopStatus")
  return <Badge variant={status === "suspended" ? "destructive" : "muted"}>{t(status)}</Badge>
}
