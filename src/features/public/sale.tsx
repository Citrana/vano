"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"
import { cn } from "cn"
import { formatMoney, type Currency } from "../../../convex/lib/money"
import type { PublicSale } from "../../../convex/lib/sales/active"
import { clockLeft, timeLeft } from "@/lib/time-left"

/**
 * How a sale looks in the shop (CLAUDE.md "Sales"): the sale price in the
 * shop's price colour, the real normal price crossed out, and the badge /
 * "Sale" label drawn with the shop's chip tokens and button style (so the
 * look's contrast check and decorations apply). Used by product cards,
 * the product page, the editor previews and the demo.
 */

/** "$7 $10" (sale price, then the normal price crossed out). */
export function SalePrice({
  price,
  sale,
  currency,
  size = "card",
}: {
  price: number
  /** A sale, or a discount code's price (only the two prices are read). */
  sale: Pick<PublicSale, "price" | "original"> | null | undefined
  currency: Currency
  size?: "card" | "page"
}) {
  const t = useTranslations("Public")
  const locale = useLocale()
  const big = size === "page"
  const priceClass = cn(
    "text-[var(--shop-price,currentColor)] tabular-nums",
    big ? "font-heading text-3xl font-bold tracking-tight" : "font-semibold"
  )
  if (!sale) return <p className={priceClass}>{formatMoney(price, currency, locale)}</p>
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="sr-only">{t("salePriceLabel")}</span>
      <span className={priceClass}>{formatMoney(sale.price, currency, locale)}</span>
      <span className="sr-only">{t("normalPriceLabel")}</span>
      <s className={cn("text-[var(--muted-foreground)] tabular-nums", big ? "text-lg" : "text-xs")}>
        {formatMoney(sale.original, currency, locale)}
      </s>
    </p>
  )
}

/** The "-30%" badge and the "Sale" label, as the seller chose (product page; cards show one badge, `cardBadge`). */
export function SaleTags({ sale, className }: { sale: PublicSale | null | undefined; className?: string }) {
  const t = useTranslations("Public")
  if (!sale || (!sale.badge && !sale.label)) return null
  const pill = "px-2.5 py-1 text-xs"
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {sale.badge ? (
        <span
          className={cn(
            "shop-btn rounded-full bg-[var(--chip,var(--foreground))] font-semibold text-[var(--chip-foreground,var(--background))] tabular-nums",
            pill,
          )}
        >
          {t("saleBadge", { percent: sale.percent })}
        </span>
      ) : null}
      {sale.label ? (
        <span className={cn("shop-chip chip-selected rounded-full border font-semibold", pill)}>{t("saleLabel")}</span>
      ) : null}
    </span>
  )
}

const TICK_MS = 1_000

/**
 * One shared one-second clock for every countdown on the page: a single
 * interval while at least one countdown is mounted and the tab is
 * visible; paused while hidden, caught up at once when shown again.
 */
const clockListeners = new Set<() => void>()
let clockTimer: number | null = null

function notifyClock() {
  for (const listener of clockListeners) listener()
}

function startClock() {
  if (clockTimer === null && !document.hidden) clockTimer = window.setInterval(notifyClock, TICK_MS)
}

function stopClock() {
  if (clockTimer !== null) window.clearInterval(clockTimer)
  clockTimer = null
}

function onVisibility() {
  if (document.hidden) return stopClock()
  notifyClock()
  startClock()
}

function subscribeClock(onTick: () => void) {
  clockListeners.add(onTick)
  if (clockListeners.size === 1) {
    document.addEventListener("visibilitychange", onVisibility)
    startClock()
  }
  return () => {
    clockListeners.delete(onTick)
    if (clockListeners.size === 0) {
      document.removeEventListener("visibilitychange", onVisibility)
      stopClock()
    }
  }
}

/** The clock in one-second steps (stable between ticks, as React requires). */
function clockSnapshot(): number {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * "Ends in 2d 4h 10m 05s", ticking every second. The browser clock only drives this display: the
 * price itself comes from the server, which ends the sale on time. When
 * it reaches zero the page is refreshed to show the normal price. No
 * animation; screen readers get the full words, not a ticking region.
 */
export function SaleCountdown({ endsAt, className }: { endsAt: number; className?: string }) {
  const t = useTranslations("Public")
  const router = useRouter()
  const now = useSyncExternalStore(subscribeClock, clockSnapshot, () => null)
  const left = now === null ? null : timeLeft(endsAt, now)
  const ended = left?.ended === true

  useEffect(() => {
    if (!ended) return
    // Give the server's scheduled job a moment, then show the normal price.
    const timer = window.setTimeout(() => router.refresh(), 5_000)
    return () => window.clearTimeout(timer)
  }, [ended, router])

  // The server snapshot is null: rendered in the browser only, so server
  // and browser clocks never disagree.
  if (left === null) return <p className={cn("h-5", className)} aria-hidden />
  if (left.ended) return <p className={cn("text-sm font-medium", className)}>{t("saleEnded")}</p>
  // Spoken once a minute (rounded); the visible digits tick every second.
  const spoken = t("saleEndsInSpoken", { days: left.days, hours: left.hours, minutes: left.minutes })
  const clock = clockLeft(endsAt, now ?? endsAt)
  const time = t("countdown", { days: clock.days, hours: clock.hours, minutes: pad(clock.minutes), seconds: pad(clock.seconds) })
  return (
    <p role="timer" aria-label={spoken} className={cn("text-sm font-medium tabular-nums", className)}>
      <span aria-hidden>{t("saleEndsIn", { time })}</span>
    </p>
  )
}
