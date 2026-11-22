"use client"

import { ArrowRightIcon, FlowerIcon, SparklesIcon, TagIcon, XIcon, type LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react"
import { cn } from "cn"
import { promoBarContent, type PromoIcon, type PromoSaleSummary } from "../../../convex/lib/looks/announcement"
import type { ResolvedAnnouncement } from "../../../convex/lib/looks/resolve"
import { SaleCountdown } from "./sale"

const ICONS: Record<Exclude<PromoIcon, "none">, LucideIcon> = { tag: TagIcon, sparkle: SparklesIcon, flower: FlowerIcon }

/** A short key for "closed for this visit" (per shop and per message). */
function storageKey(slug: string, content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) hash = (hash * 31 + content.charCodeAt(i)) | 0
  return `vano.promo.${slug}.${hash}`
}

/** Session storage doesn't notify this tab; closing updates local state instead. */
const subscribeNever = () => () => {}

function readClosed(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1"
  } catch {
    // Storage blocked: the bar just shows.
    return false
  }
}

/** The bar's colours: the seller's (resolved, contrast checked) or, without a bar, the card strip. */
function barStyle(bar: ResolvedAnnouncement | null): CSSProperties | undefined {
  if (!bar) return undefined
  return {
    color: bar.foreground,
    backgroundColor: bar.background,
    backgroundImage: bar.gradientTo ? `linear-gradient(90deg, ${bar.background}, ${bar.gradientTo})` : undefined,
    borderColor: bar.border ?? "transparent",
  }
}

/**
 * The Promo bar (CLAUDE.md "Shop looks"): one slim line under the shop
 * header. A running sale wins (title, discount, countdown, "View sale"),
 * then the seller's text, else nothing (`promoBarContent`). `bar` is the
 * seller's Promo bar when live and in the plan (`shownLook`), else null:
 * a running sale still shows, in the plain card style (sales are already
 * a paid feature). Visitors can close it for the visit when the seller
 * allows it (session storage, wrapped in try/catch). `preview`: inert
 * (look editor).
 */
export function PromoBar({
  bar,
  sale,
  slug,
  preview = false,
  className,
}: {
  bar: ResolvedAnnouncement | null
  sale: PromoSaleSummary | null
  slug: string
  preview?: boolean
  className?: string
}) {
  const t = useTranslations("Public.promo")
  const content = promoBarContent(bar, sale)
  const signature = content
    ? content.kind === "sale"
      ? `sale:${content.title ?? ""}:${content.percent}`
      : `text:${content.text}`
    : ""
  const key = storageKey(slug, signature)
  // The server (and the first client render) shows the bar; then the stored choice applies.
  const closedBefore = useSyncExternalStore(subscribeNever, () => !preview && readClosed(key), () => false)
  const [closedKey, setClosedKey] = useState<string | null>(null)

  if (!content || closedBefore || closedKey === key) return null

  const closable = bar?.closable ?? false
  const iconId: PromoIcon = bar ? bar.icon : "tag"
  const Icon = iconId === "none" ? null : ICONS[iconId]

  function close() {
    setClosedKey(key)
    try {
      window.sessionStorage.setItem(key, "1")
    } catch {
      // Storage blocked: closed until the page reloads.
    }
  }

  const linkClass = "inline-flex min-h-11 shrink-0 items-center gap-1 font-semibold underline underline-offset-4 rounded-sm focus-ring"
  const arrow = <ArrowRightIcon className="size-3.5" aria-hidden />
  let link: ReactNode = null
  let message: ReactNode
  if (content.kind === "sale") {
    const discount = content.uniform ? t("off", { percent: content.percent }) : t("upToOff", { percent: content.percent })
    message = (
      <>
        <span className="font-semibold">{content.title ?? t("saleTitle")}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{discount}</span>
        {content.endsAt !== null ? (
          <>
            <span aria-hidden>·</span>
            <SaleCountdown endsAt={content.endsAt} className="text-[13px] font-normal" />
          </>
        ) : null}
      </>
    )
    link = preview ? (
      <span className={linkClass}>
        {t("viewSale")}
        {arrow}
      </span>
    ) : (
      <Link href={`/${slug}?sale=1#products`} className={linkClass}>
        {t("viewSale")}
        {arrow}
      </Link>
    )
  } else {
    message = <span className="min-w-0 text-pretty">{content.text}</span>
    const target = content.link
    // The text's "sale" link only exists while a sale runs, and then the sale fills the bar instead.
    if (target?.kind === "url") {
      link = preview ? (
        <span className={linkClass} aria-hidden>
          {arrow}
        </span>
      ) : (
        <a href={target.url} target="_blank" rel="noopener noreferrer nofollow" className={linkClass} aria-label={t("openLink")}>
          {arrow}
        </a>
      )
    }
  }

  return (
    <div
      role="region"
      aria-label={t("label")}
      style={barStyle(bar)}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm border ps-3 text-[13px] leading-snug",
        bar ? "" : "bg-card",
        closable ? "pe-0" : "pe-3",
        className,
      )}
    >
      {Icon ? (
        <Icon className={cn("size-4 shrink-0", bar ? "" : "text-[var(--shop-price,currentColor)]")} aria-hidden />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0 py-2">{message}</div>
      {link}
      {closable ? (
        preview ? (
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center opacity-80">
            <XIcon className="size-4" />
          </span>
        ) : (
          <button
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="flex size-11 shrink-0 items-center justify-center rounded-sm opacity-80 hover:opacity-100 focus-ring"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        )
      ) : null}
    </div>
  )
}
