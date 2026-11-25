"use client"

import { useMutation } from "convex/react"
import { ImageIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import type { CSSProperties } from "react"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { formatMoney, type Currency } from "../../../convex/lib/money"
import type { PublicSale } from "../../../convex/lib/sales/active"
import { buttonVariants } from "@/components/ui/button"
import { productUrl } from "@/lib/site"
import { orderHref } from "@/lib/whatsapp"
import { useShopOrder } from "./order-context"
import { cardBadge, type CardBadge } from "./card-badge"
import { SaleSeal } from "./sale-seal"
import { SalePrice } from "./sale"
import { ShareButton } from "./share-button"
import { WhatsAppIcon } from "./whatsapp-icon"
import { colorSwatch } from "../../../convex/lib/colorSwatches"
import { CARD_TAGS_MAX } from "../../../convex/lib/catalog"

/** Small badge pills (shop button radius): filled, ink, or outlined. */
const PILL = "shop-btn rounded-full px-2 py-0.5 text-[11px] font-semibold"
const FILLED_PILL = `${PILL} bg-[var(--chip,var(--foreground))] text-[var(--chip-foreground,var(--background))]`
const INK_PILL = `${PILL} bg-[var(--foreground)] text-[var(--background)]`
const OUTLINED_PILL = `${PILL} border border-[var(--chip,var(--foreground))] bg-[var(--card)] text-[var(--foreground)]`

/** The cards' corners: small, like the photos (CLAUDE.md "Shop looks"). */
const CARD_RADIUS = "rounded-[min(var(--radius-sm),0.375rem)]"

/**
 * A product card (CLAUDE.md "Shop looks"), after the reference design: a
 * soft tinted card (the look's muted colour, no border, no shadow) with
 * compact padding. A 4:5 photo area (the whole photo fits, never cropped
 * or zoomed) and one badge (`cardBadge`: Sold out, sale, New, section
 * label, Few left; the first that applies): a sale is a scalloped seal
 * inside the card's top-right corner (`SaleSeal`), the others a pill on the
 * photo's top-left; the
 * name on one line with the prices right under it (old price crossed out
 * on sale); colours as dots and sizes as chips in one row; then, on shop
 * pages, a compact WhatsApp Order button with a square share button
 * beside it. The whole card opens the product (stretched link).
 */
export function ProductCard({
  productId,
  href,
  name,
  price,
  currency,
  soldOut,
  coverUrl,
  sale = null,
  fewLeft = false,
  isNew = false,
  highlight = null,
  size = "default",
  colors: allColors = [],
  sizes: allSizes = [],
}: {
  productId?: string
  href: string
  name: string
  price: number
  currency: Currency
  soldOut: boolean
  coverUrl: string | null
  /** The live sale, when there is one (CLAUDE.md "Sales"). */
  sale?: PublicSale | null
  /** The seller's "Few left" label (never with Sold out). */
  fewLeft?: boolean
  /** Added in the last NEW_BADGE_DAYS. */
  isNew?: boolean
  /** A section's own label, e.g. "Back in stock" in that section. */
  highlight?: string | null
  /** "large": the big-card layout (larger name). */
  size?: "default" | "large"
  /** Every colour name and size; the card shows the first CARD_TAGS_MAX and "+N". */
  colors?: string[]
  sizes?: string[]
}) {
  const t = useTranslations("Public")
  const locale = useLocale()
  const shownPrice = formatMoney(sale ? sale.price : price, currency, locale)
  const colors = allColors.slice(0, CARD_TAGS_MAX)
  const moreColors = Math.max(0, allColors.length - CARD_TAGS_MAX)
  const sizes = allSizes.slice(0, CARD_TAGS_MAX)
  const moreSizes = Math.max(0, allSizes.length - CARD_TAGS_MAX)
  const badge = cardBadge({ soldOut, sale, isNew, highlight, fewLeft })
  // A sale is a seal inside the card's top-right corner; any other badge a pill on the photo.
  const sealLabel =
    badge?.kind === "salePercent" ? t("saleBadge", { percent: badge.percent }) : badge?.kind === "saleLabel" ? t("saleLabel") : null
  const pill = badge && badge.kind !== "salePercent" && badge.kind !== "saleLabel" ? badge : null
  return (
    <article
      className={cn(
        "@container group relative flex h-full flex-col bg-muted p-2.5 md:p-3",
        CARD_RADIUS,
        "motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--muted),var(--foreground)_4%)]",
        "has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-offset-2 has-[[data-card-link]:focus-visible]:outline-ring",
      )}
    >
      {sealLabel ? <SaleSeal label={sealLabel} className="top-1 right-1 md:top-1.5 md:right-1.5" /> : null}
      {/* The 4:5 photo area: the whole photo fits inside (never cropped or zoomed), badges on its top-left corner. */}
      <div className="relative flex aspect-[4/5] items-center justify-center">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              // max-* so the rounded corners are on the visible photo itself.
              "max-h-full max-w-full object-contain",
              CARD_RADIUS,
              soldOut && "opacity-60 grayscale",
            )}
          />
        ) : (
          <div className={cn("flex size-full items-center justify-center bg-card text-muted-foreground", CARD_RADIUS)}>
            <ImageIcon className="size-8" aria-hidden />
          </div>
        )}
        {pill ? (
          <div className="pointer-events-none absolute top-1.5 left-1.5 flex pe-1.5">
            <BadgePill badge={pill} />
          </div>
        ) : null}
      </div>

      {/* The name on one line; its link covers the whole card. */}
      <Link
        href={href}
        data-card-link=""
        aria-label={`${name}, ${shownPrice}`}
        className="mt-2 outline-none after:absolute after:inset-0 after:content-['']"
      >
        <h3
          className={cn(
            "truncate font-heading leading-snug font-medium",
            size === "large" ? "text-base md:text-lg" : "text-sm",
          )}
        >
          {name}
        </h3>
      </Link>
      {/* The prices right under it: the sale price, then the old price crossed out. */}
      <div className="mt-0.5 text-sm">
        <SalePrice price={price} sale={sale} currency={currency} />
      </div>

      {colors.length > 0 || sizes.length > 0 ? (
        // One compact row that never grows: anything that doesn't fit is clipped at the card edge.
        <div className="mt-1.5 flex items-center gap-2 overflow-hidden whitespace-nowrap">
          {colors.length > 0 ? (
            <ul aria-label={t("colorsLabel")} className="flex shrink-0 items-center gap-1">
              {colors.map((color) => {
                const swatch = colorSwatch(color)
                return swatch ? (
                  <li key={color} title={color} aria-label={color} className="flex size-5 items-center justify-center">
                    {/* The swatch is the seller's colour, drawn as data (not a theme colour). */}
                    <span className="size-3.5 rounded-full ring-1 ring-foreground/20" style={{ backgroundColor: swatch }} />
                  </li>
                ) : (
                  <li key={color} className="rounded-sm border px-1.5 text-[11px] leading-5">
                    {color}
                  </li>
                )
              })}
              {moreColors > 0 ? <li className="text-[11px] text-muted-foreground">+{moreColors}</li> : null}
            </ul>
          ) : null}
          {sizes.length > 0 ? (
            <ul aria-label={t("sizesLabel")} className="flex shrink-0 items-center gap-1">
              {sizes.map((s) => (
                <li key={s} className="rounded-sm border bg-card px-1.5 text-[11px] leading-5 font-medium">
                  {s}
                </li>
              ))}
              {moreSizes > 0 ? <li className="text-[11px] text-muted-foreground">+{moreSizes}</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {productId ? (
        // Order takes the width; share is a square icon button beside it.
        <div className="relative z-10 mt-auto flex gap-2 pt-3">
          <div className="min-w-0 flex-1">
            <OrderButton productId={productId} name={name} price={price} sale={sale} soldOut={soldOut} />
          </div>
          <CardShareButton productId={productId} name={name} />
        </div>
      ) : null}
    </article>
  )
}

/** The card's one badge pill (not a sale: that's the corner seal). */
function BadgePill({ badge }: { badge: Exclude<CardBadge, { kind: "salePercent" | "saleLabel" }> }) {
  const t = useTranslations("Public")
  switch (badge.kind) {
    case "soldOut":
      return <span className={INK_PILL}>{t("soldOut")}</span>
    case "new":
      return <span className={FILLED_PILL}>{t("newBadge")}</span>
    case "highlight":
      return <span className={FILLED_PILL}>{badge.label}</span>
    case "fewLeft":
      return <span className={OUTLINED_PILL}>{t("fewLeft")}</span>
  }
}

/** Shares the product's link (next to Order), on shop pages (`ShopOrderProvider`). */
function CardShareButton({ productId, name }: { productId: string; name: string }) {
  const order = useShopOrder()
  if (!order) return null
  return (
    <ShareButton
      name={name}
      preview={order.preview}
      url={() => (order.demo ? `${window.location.origin}/demo/${productId}` : productUrl(order.slug, productId))}
      // The Order button's 10px corners, 44px on phones.
      className="size-11 rounded-[0.625rem] md:size-10"
    />
  )
}

/** The compact Order button's 10px corners: the look's button rules (and designs) read this variable. */
const COMPACT_RADIUS = { "--shop-btn-radius": "0.625rem" } as CSSProperties

/** The compact "Order on WhatsApp" button, on shop pages (`ShopOrderProvider`). */
function OrderButton({
  productId,
  name,
  price,
  sale,
  soldOut,
}: {
  productId: string
  name: string
  price: number
  sale: PublicSale | null
  soldOut: boolean
}) {
  const t = useTranslations("Public")
  const locale = useLocale()
  const order = useShopOrder()
  const recordClick = useMutation(api.stats.recordWhatsappClick)
  if (!order) return null

  const orderClass = buttonVariants({
    variant: "whatsapp",
    size: "sm",
    className: "shop-btn shop-action min-h-11 w-full px-3 text-sm md:min-h-10",
  })
  const label = (
    <>
      <WhatsAppIcon className="size-4" />
      <span className="@[15rem]:hidden">{t("orderShort")}</span>
      <span className="hidden truncate @[15rem]:inline">{t(`orderLabels.${order.label}`)}</span>
    </>
  )

  // Live: the last piece may sell while the page is open.
  if (soldOut || (!order.preview && order.livePrice(productId)?.soldOut)) {
    return (
      <span
        style={COMPACT_RADIUS}
        aria-disabled
        className={buttonVariants({
          variant: "secondary",
          size: "sm",
          className: "shop-btn min-h-11 w-full cursor-not-allowed text-sm opacity-70 md:min-h-10",
        })}
      >
        {t("orderSoldOut")}
      </span>
    )
  }
  if (order.preview) return <span style={COMPACT_RADIUS} className={orderClass}>{label}</span>

  // The live price when it's there, so the message has the price at tap time.
  const live = order.livePrice(productId)
  const normal = live?.price ?? price
  const current = live ? live.sale : sale
  const whatsappHref = orderHref(t, {
    product: name,
    price: formatMoney(current ? current.price : normal, order.currency, locale),
    normalPrice: current ? formatMoney(current.original, order.currency, locale) : undefined,
    url: productUrl(order.slug, productId),
    whatsappNumber: order.whatsappNumber,
    demo: order.demo,
    demoNote: t("demoOrderNote"),
  })
  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${t(`orderLabels.${order.label}`)}: ${name}`}
      onClick={() => {
        if (!order.demo) recordClick({ productId }).catch(() => {})
      }}
      style={COMPACT_RADIUS}
      className={orderClass}
    >
      {label}
    </a>
  )
}
