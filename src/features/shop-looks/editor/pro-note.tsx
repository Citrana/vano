"use client"

import { LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"

/** "Available on Pro · See plans" under options the seller's plan doesn't include. */
export function ProNote() {
  const t = useTranslations("LookEditor.lock")
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <LockIcon className="size-3.5" aria-hidden />
      {t("availableOnPro")}
      <Link href="/dashboard/billing" className="font-medium text-foreground underline underline-offset-4">
        {t("link")}
      </Link>
    </p>
  )
}
