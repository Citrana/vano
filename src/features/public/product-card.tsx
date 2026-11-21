"use client"

import { ImageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { cn } from "cn"
import type { Currency } from "../../../convex/lib/money"
import type { PublicSale } from "../../../convex/lib/sales/active"
import { SalePrice, SaleTags } from "./sale"

export function ProductCard({
  href,
  name,
  price,
  currency,
  soldOut,
  coverUrl,
  sale = null,
}: {
  href: string
  name: string
  price: number
  currency: Currency
  soldOut: boolean
  coverUrl: string | null
  /** The live sale, when there is one (CLAUDE.md "Sales"). */
  sale?: PublicSale | null
}) {
  const t = useTranslations("Public")
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
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <span className="shop-btn rounded-full bg-[var(--chip,var(--foreground))] px-2.5 py-1 text-xs font-semibold text-[var(--chip-foreground,var(--background))]">
              {t("soldOut")}
            </span>
          ) : null}
          <SaleTags sale={sale} />
        </div>
      </div>
      <div className="px-0.5">
        <p className="line-clamp-2 text-sm leading-snug">{name}</p>
        <div className="mt-0.5">
          <SalePrice price={price} sale={sale} currency={currency} />
        </div>
      </div>
    </Link>
  )
}
