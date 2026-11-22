"use client"

import { useMutation } from "convex/react"
import { ImageIcon, MessageCircleIcon, Share2Icon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
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

const FILLED_TAG =
  "shop-btn rounded-full bg-[var(--chip,var(--foreground))] px-2.5 py-1 text-xs font-semibold text-[var(--chip-foreground,var(--background))]"
const OUTLINED_TAG =
  "shop-btn rounded-full border border-[var(--chip,var(--foreground))] bg-[var(--card)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]"

/**
 * A product card (CLAUDE.md "Shop looks"): a compact, barely rounded
 * bordered card. A square photo area shows the whole photo (never cropped
 * or zoomed) on the card background, with the tags (Sold out, sale,
 * section label, Few left) at its top left and a share button at its top
 * right; then the name with the price (old price crossed out on sale),
 * the colours and, on shop pages, a slim "Order on
 * WhatsApp" button. The photo and the name open the product. Same size in
 * every grid, whatever the number of products.
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
  highlight = null,
  size = "default",
  colors = [],
  moreColors = 0,
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
  /** A section's own label, e.g. "Back in stock" in that section. */
  highlight?: string | null
  /** "large": the big-card layout (larger name). */
  size?: "default" | "large"
  /** Up to 4 colour names, and how many more there are. */
  colors?: string[]
  moreColors?: number
}) {
  const t = useTranslations("Public")
  return (
    <article className="@container flex h-full flex-col rounded-[min(var(--radius-sm),0.375rem)] border bg-card p-3 md:p-4">
      <div className="relative aspect-square">
        <Link href={href} tabIndex={-1} aria-hidden className="block size-full">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
            <img
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn("size-full object-contain", soldOut && "opacity-60 grayscale")}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className="size-8" aria-hidden />
            </div>
          )}
        </Link>
        <div className="pointer-events-none absolute top-0 left-0 flex flex-wrap items-start gap-1.5 pe-12">
          {soldOut ? <span className={FILLED_TAG}>{t("soldOut")}</span> : null}
          <SaleTags sale={sale} />
          {highlight && !soldOut ? <span className={FILLED_TAG}>{highlight}</span> : null}
          {fewLeft && !soldOut ? <span className={OUTLINED_TAG}>{t("fewLeft")}</span> : null}
        </div>
        {productId ? (
          <div className="absolute top-0 right-0">
            <ShareButton productId={productId} name={name} />
          </div>
        ) : null}
      </div>

      {/* Name left, price right (under the name on narrow cards). */}
      <div className="mt-3 flex flex-col gap-0.5 @[15rem]:flex-row @[15rem]:items-start @[15rem]:justify-between @[15rem]:gap-3">
        <Link href={href} className="min-w-0 rounded-sm focus-ring">
          <h3
            className={cn(
              "line-clamp-2 font-heading leading-tight font-semibold tracking-tight",
              size === "large" ? "text-lg md:text-xl" : "text-base md:text-lg",
            )}
          >
            {name}
          </h3>
        </Link>
        <div className="shrink-0 text-sm @[15rem]:pt-0.5 @[15rem]:text-end [&_p]:@[15rem]:justify-end">
          <SalePrice price={price} sale={sale} currency={currency} />
        </div>
      </div>

      {colors.length > 0 ? (
        <ul aria-label={t("colorsLabel")} className="mt-2 flex flex-wrap gap-1.5">
          {colors.map((color) => (
            <li key={color} className="rounded-full border px-2 py-0.5 text-xs">
              {color}
            </li>
          ))}
          {moreColors > 0 ? <li className="px-1 py-0.5 text-xs text-muted-foreground">+{moreColors}</li> : null}
        </ul>
      ) : null}

      {productId ? (
        <div className="mt-auto pt-3">
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

/** The slim "Order on WhatsApp" button, on shop pages (`ShopOrderProvider`). */
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
    className: "shop-btn shop-action min-h-11 w-full px-2 md:min-h-9",
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
        aria-disabled
        className={buttonVariants({
          variant: "secondary",
          size: "sm",
          className: "shop-btn min-h-11 w-full cursor-not-allowed opacity-70 md:min-h-9",
        })}
      >
        {t("orderSoldOut")}
      </span>
    )
  }
  if (order.preview) return <span className={orderClass}>{label}</span>

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
      className={orderClass}
    >
      {label}
    </a>
  )
}
