"use client"

import { ArrowRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

/** The Look editor's Promo bar tab: the bar is edited on the Sales page now. */
export function PromoBarMoved() {
  const t = useTranslations("LookEditor.announcement")
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">{t("movedTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("movedBody")}</p>
      <Link href="/dashboard/sales#promo-bar" className={buttonVariants({ variant: "outline", className: "w-fit" })}>
        {t("editInSales")}
        <ArrowRightIcon aria-hidden />
      </Link>
    </div>
  )
}
