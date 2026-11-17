"use client"

import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"

export function UserStatusBadge({ status }: { status: "active" | "suspended" }) {
  const t = useTranslations("UserStatus")
  return <Badge variant={status === "suspended" ? "destructive" : "muted"}>{t(status)}</Badge>
}
