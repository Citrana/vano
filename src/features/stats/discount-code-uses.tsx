"use client"

import { TicketPercentIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { Card, CardTitle } from "@/components/ui/card"

export type CodeUses = { codeId: string; code: string; uses: number; maxUses: number | null }

/**
 * Orders placed with each discount code, most used first (CLAUDE.md
 * "Discount codes"). Shown on the stats page when the shop has codes.
 */
export function DiscountCodeUses({ codes }: { codes: readonly CodeUses[] }) {
  const t = useTranslations("Stats.discountCodes")
  const tc = useTranslations("DiscountCodes")
  if (codes.length === 0) return null
  return (
    <Card className="gap-3">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TicketPercentIcon className="size-4" aria-hidden />
          {t("title")}
        </CardTitle>
        <Link href="/dashboard/discount-codes" className="flex min-h-11 items-center text-sm underline underline-offset-4 focus-ring">
          {t("manage")}
        </Link>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border">
        {codes.map((c) => (
          <li key={c.codeId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="min-w-0 truncate font-mono font-medium tracking-wide">{c.code}</span>
            <span className="shrink-0 tabular-nums">
              {c.maxUses === null ? tc("usesCount", { count: c.uses }) : tc("usesOf", { uses: c.uses, max: c.maxUses })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
