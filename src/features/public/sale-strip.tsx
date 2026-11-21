"use client"

import { TagIcon } from "lucide-react"
import { SaleCountdown } from "./sale"

/**
 * "Sale ends in 2d 4h 10m" above the shop's products, for the running
 * sale that ends first among those showing a countdown (CLAUDE.md "Sales").
 */
export function SaleStrip({ endsAt }: { endsAt: number }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 py-2">
      <TagIcon className="size-4 shrink-0 text-[var(--shop-price,currentColor)]" aria-hidden />
      <SaleCountdown endsAt={endsAt} />
    </div>
  )
}
