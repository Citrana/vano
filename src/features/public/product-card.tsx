"use client"

import { useMutation } from "convex/react"
import { ImageIcon, MessageCircleIcon, Share2Icon } from "lucide-react"
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
import { SalePrice, SaleTags } from "./sale"
import { useShare } from "./use-share"
import { colorSwatch } from "../../../convex/lib/colorSwatches"

/** Small badge pills (shop button radius): filled, or outlined. */
const PILL = "shop-btn rounded-full px-2 py-0.5 text-[11px] font-semibold"
const FILLED_PILL = `${PILL} bg-[var(--chip,var(--foreground))] text-[var(--chip-foreground,var(--background))]`
const INK_PILL = `${PILL} bg-[var(--foreground)] text-[var(--background)]`
const OUTLINED_PILL = `${PILL} border border-[var(--chip,var(--foreground))] bg-[var(--card)] text-[var(--foreground)]`

/**
 * A product card (CLAUDE.md "Shop looks"), after the reference design: a
 * soft tinted card (the look's muted colour, no border, no shadow) with
 * airy padding. Badge pills (Sold out, sale, New, section label, Few left)
 * top-left and share top-right; the whole photo, never cropped or zoomed;
 * the name and price on one line (old price crossed out on sale); colours
 * as dots and sizes as chips; then, on shop pages, a compact WhatsApp
 * Order button. The whole card opens the product (stretched link).
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
  colors = [],
  moreColors = 0,
  sizes = [],
  moreSizes = 0,
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
  /** Up to 4 colour names and sizes, and how many more there are. */
  colors?: string[]
  moreColors?: number
  sizes?: string[]
  moreSizes?: number
}) {
  const t = useTranslations("Public")
  const locale = useLocale()
  const shownPrice = formatMoney(sale ? sale.price : price, currency, locale)
  return (
    <article
      className={cn(
        "@container group relative flex h-full flex-col rounded-[min(var(--radius-sm),0.5rem)] bg-muted p-3 md:p-4",
        "motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--muted),var(--foreground)_4%)]",
        "has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-offset-2 has-[[data-card-link]:focus-visible]:outline-ring",
      )}
    >
      {/* Pills left, share right. */}
      <div className="flex min-h-11 items-start justify-between gap-2 md:min-h-9">
        <div className="flex min-w-0 flex-wrap items-start gap-1.5 pt-1">
          {soldOut ? <span className={INK_PILL}>{t("soldOut")}</span> : null}
          <SaleTags sale={sale} size="sm" />
          {isNew && !soldOut ? <span className={FILLED_PILL}>{t("newBadge")}</span> : null}
          {highlight && !soldOut ? <span className={FILLED_PILL}>{highlight}</span> : null}
          {fewLeft && !soldOut ? <span className={OUTLINED_PILL}>{t("fewLeft")}</span> : null}
        </div>
        {productId ? (
          <div className="relative z-10">
            <ShareButton productId={productId} name={name} />
          </div>
        ) : null}
      </div>

      {/* The whole photo, never cropped or zoomed; white backgrounds melt into a light card. */}
      <div className="my-2 aspect-square md:my-3">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              "size-full object-contain mix-blend-multiply [[data-look-dark]_&]:mix-blend-normal",
              soldOut && "opacity-60 grayscale",
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-8" aria-hidden />
          </div>
        )}
      </div>

      {/* Name and price on one line; the name link covers the whole card. */}
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={href}
          data-card-link=""
          aria-label={`${name}, ${shownPrice}`}
          className="min-w-0 outline-none after:absolute after:inset-0 after:content-['']"
        >
          <h3
            className={cn(
              "truncate font-heading leading-tight font-semibold tracking-tight",
              size === "large" ? "text-lg md:text-2xl" : "text-base md:text-xl",
            )}
          >
            {name}
          </h3>
        </Link>
        <div className="shrink-0 text-end text-sm whitespace-nowrap [&_p]:justify-end">
          <SalePrice price={price} sale={sale} currency={currency} />
        </div>
      </div>

      {colors.length > 0 || sizes.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {colors.length > 0 ? (
            <ul aria-label={t("colorsLabel")} className="flex flex-wrap items-center gap-1.5">
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
            <ul aria-label={t("sizesLabel")} className="flex flex-wrap items-center gap-1">
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
        <div className="relative z-10 mt-auto pt-3">
          <OrderButton productId={productId} name={name} price={price} sale={sale} soldOut={soldOut} />
        </div>
      ) : null}
    </article>
  )
}

/** Plain classes on purpose: `.shop-chip` sets `position: relative` in shop scopes. */
const ROUND_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full border bg-card text-foreground md:size-9 [&_svg]:size-4"

/** Shares the product's link (top right of the photo), on shop pages (`ShopOrderProvider`). */
function ShareButton({ productId, name }: { productId: string; name: string }) {
  const t = useTranslations("Public")
  const order = useShopOrder()
  const share = useShare()
  if (!order) return null
  if (order.preview) {
    return (
      <span aria-hidden className={ROUND_BUTTON}>
        <Share2Icon />
      </span>
    )
  }
  // Read on tap (`window` doesn't exist while the page renders on the server).
  const url = () => (order.demo ? `${window.location.origin}/demo/${productId}` : productUrl(order.slug, productId))
  return (
    <button
      type="button"
      aria-label={t("shareProduct", { product: name })}
      title={t("shareProduct", { product: name })}
      onClick={() => void share({ title: name, url: url() })}
      className={cn(ROUND_BUTTON, "transition-colors hover:bg-muted focus-ring")}
    >
      <Share2Icon />
    </button>
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
      <MessageCircleIcon />
      <span className="@[15rem]:hidden">{t("orderShort")}</span>
      <span className="hidden truncate @[15rem]:inline">{t(`orderLabels.${order.label}`)}</span>
    </>
  )

  if (soldOut) {
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
