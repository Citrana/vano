"use client"

import { ImageIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { cn } from "cn"
import { formatMoney, type Currency } from "../../../convex/lib/money"

export function ProductCard({
  href,
  name,
  price,
  currency,
  soldOut,
  coverUrl,
}: {
  href: string
  name: string
  price: number
  currency: Currency
  soldOut: boolean
  coverUrl: string | null
}) {
  const t = useTranslations("Public")
  const locale = useLocale()
  return (
    <Link href={href} className="group flex flex-col gap-2 rounded-xl focus-ring">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn("size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]", soldOut && "opacity-60 grayscale")}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-8" aria-hidden />
          </div>
        )}
        {soldOut ? (
          <span className="shop-btn absolute top-2 left-2 rounded-full bg-[var(--chip,var(--foreground))] px-2.5 py-1 text-xs font-semibold text-[var(--chip-foreground,var(--background))]">
            {t("soldOut")}
          </span>
        ) : null}
      </div>
      <div className="px-0.5">
        <p className="line-clamp-2 text-sm leading-snug">{name}</p>
        <p className="mt-0.5 font-semibold text-[var(--shop-price,currentColor)] tabular-nums">{formatMoney(price, currency, locale)}</p>
      </div>
    </Link>
  )
}
