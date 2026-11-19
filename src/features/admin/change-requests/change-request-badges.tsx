"use client"

import { AlertTriangleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ChangeFlag, ChangeStatus } from "../../../../convex/lib/changeRequests"
import { Badge } from "@/components/ui/badge"

const STATUS_VARIANT: Record<ChangeStatus, "default" | "secondary" | "muted" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "muted",
}

export function ChangeStatusBadge({ status }: { status: ChangeStatus }) {
  const t = useTranslations("ChangeRequests.status")
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>
}

/** Warnings for the admin: a brand name, a change inside the cooldown. */
export function ChangeFlags({ flags, matchedBrand }: { flags: ChangeFlag[]; matchedBrand: string | null }) {
  const t = useTranslations("AdminChangeRequests.flag")
  if (flags.length === 0) return null
  return (
    <>
      {flags.map((flag) => (
        <Badge key={flag} variant="outline" className="border-destructive/40 text-destructive">
          <AlertTriangleIcon className="size-3" aria-hidden />
          {flag === "brand" ? t("brand", { brand: matchedBrand ?? "" }) : t("cooldown")}
        </Badge>
      ))}
    </>
  )
}
