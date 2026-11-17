"use client"

import { useQuery } from "convex/react"
import { AlertTriangleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { api } from "../../../convex/_generated/api"

/**
 * Warning strip under the seller header while an admin has suspended the
 * shop. The server refuses every change (SHOP_SUSPENDED); this says why.
 */
export function ShopSuspendedBanner() {
  const t = useTranslations("Suspension")
  const viewer = useQuery(api.users.viewer, {})
  if (viewer?.shopStatus !== "suspended") return null
  return (
    <div role="status" className="border-b border-destructive/30 bg-destructive/10">
      <p className="mx-auto flex max-w-5xl items-start gap-2 px-4 py-3 text-sm">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        {t("shopBanner")}
      </p>
    </div>
  )
}
