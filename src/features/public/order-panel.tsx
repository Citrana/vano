"use client"

import { useMutation, useQuery } from "convex/react"
import { MessageCircleIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState, type CSSProperties } from "react"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import type { OrderLabel } from "../../../convex/lib/looks/buttonDesigns"
import { formatMoney, type Currency } from "../../../convex/lib/money"
import type { PublicSale } from "../../../convex/lib/sales/active"
import { colorSwatch } from "../../../convex/lib/colorSwatches"
import { SaleCountdown, SalePrice, SaleTags } from "./sale"
import { ShareButton } from "./share-button"
import { buttonVariants } from "@/components/ui/button"
import { productUrl } from "@/lib/site"
import { orderHref } from "@/lib/whatsapp"

/** Size chips and colour dots: square corners on the product page, whatever the button shape. */
const SQUARE_CHIP = { "--shop-btn-radius": "2px" } as CSSProperties

function OptionLegend({ label, value }: { label: string; value?: string }) {
  return (
    <legend className="mb-2.5 text-xs font-semibold tracking-wide uppercase">
      {label}
      {value ? <span className="ms-1.5 font-normal tracking-normal normal-case text-muted-foreground">{value}</span> : null}
    </legend>
  )
}

/** Sizes as small filled rectangles (selected: the look's chip colours). */
function SizeChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  if (options.length === 0) return null
  return (
    <fieldset>
      <OptionLegend label={label} />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(value === option ? undefined : option)}
            style={SQUARE_CHIP}
            className={cn(
              "shop-chip min-h-11 min-w-14 border px-3 text-sm font-medium transition-colors focus-ring md:min-h-10",
              value === option
                ? "chip-selected"
                : "border-transparent bg-muted hover:border-foreground/30 in-data-[btn-fill=outline]:border-border",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Colours as dots (`colorSwatch`); a name without a known colour stays a text chip. */
function ColorDots({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  if (options.length === 0) return null
  return (
    <fieldset>
      <OptionLegend label={label} value={value} />
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((option) => {
          const selected = value === option
          const swatch = colorSwatch(option)
          const toggle = () => onChange(selected ? undefined : option)
          return swatch ? (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              aria-label={option}
              title={option}
              onClick={toggle}
              className={cn(
                "flex size-11 items-center justify-center rounded-full border-2 transition-colors focus-ring md:size-10",
                selected ? "border-foreground" : "border-transparent hover:border-foreground/30",
              )}
            >
              {/* The swatch is the seller's colour, drawn as data (not a theme colour). */}
              <span className="size-7 rounded-full ring-1 ring-foreground/20" style={{ backgroundColor: swatch }} />
            </button>
          ) : (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={toggle}
              style={SQUARE_CHIP}
              className={cn(
                "shop-chip min-h-11 border px-3 text-sm font-medium transition-colors focus-ring md:min-h-10",
                selected ? "chip-selected" : "border-transparent bg-muted hover:border-foreground/30 in-data-[btn-fill=outline]:border-border",
              )}
            >
              {option}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Price, size/colour choice and the "Order on WhatsApp" button with
 * share beside it (a fixed bottom bar on phones). The click
 * is recorded (anonymously) without delaying the link. The price is
 * re-read live from the server (`public.productPrice`), so the WhatsApp
 * message carries the price at the moment the customer taps, even if a
 * sale started or ended since the page opened (CLAUDE.md "Sales"). In `demo` mode
 * (marketing demo shop) WhatsApp opens with a labelled demo message for
 * any contact, and nothing is recorded.
 */
export function OrderPanel({
  slug,
  whatsappNumber,
  currency,
  product,
  label = "order",
  demo = false,
}: {
  slug: string
  whatsappNumber?: string
  demo?: boolean
  /** The order button's wording, from the shop look (`Public.orderLabels.*`). */
  label?: OrderLabel
  currency: Currency
  product: {
    _id: string
    name: string
    price: number
    sizes: string[]
    colors: string[]
    soldOut: boolean
    sale?: PublicSale | null
  }
}) {
  const t = useTranslations("Public")
  const locale = useLocale()
  const recordClick = useMutation(api.stats.recordWhatsappClick)
  const live = useQuery(api.public.productPrice, demo ? "skip" : { productId: product._id })
  const [size, setSize] = useState<string>()
  const [color, setColor] = useState<string>()
  // The server-rendered values until the live ones arrive.
  const normal = live?.price ?? product.price
  const sale = live === undefined || live === null ? (product.sale ?? null) : live.sale
  const href = orderHref(t, {
    product: product.name,
    price: formatMoney(sale ? sale.price : normal, currency, locale),
    normalPrice: sale ? formatMoney(sale.original, currency, locale) : undefined,
    size,
    color,
    url: productUrl(slug, product._id),
    whatsappNumber,
    demo,
    demoNote: t("demoOrderNote"),
  })

  const shareUrl = () => (demo ? `${window.location.origin}/demo/${product._id}` : productUrl(slug, product._id))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SalePrice price={normal} sale={sale} currency={currency} size="page" />
        <SaleTags sale={sale} />
        {sale?.countdown ? <SaleCountdown endsAt={sale.endsAt} /> : null}
      </div>
      <SizeChips label={t("sizes")} options={product.sizes} value={size} onChange={setSize} />
      <ColorDots label={t("colors")} options={product.colors} value={color} onChange={setColor} />
      {/* Phones: a fixed bar, so ordering is always one tap away (the page leaves room for it). */}
      <div className="fixed inset-x-0 bottom-[var(--bottom-bar,0px)] z-30 flex gap-2 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        {product.soldOut ? (
          <span
            className={buttonVariants({ size: "lg", variant: "secondary", className: "shop-btn min-w-0 flex-1 cursor-not-allowed opacity-70" })}
            aria-disabled
          >
            {t("orderSoldOut")}
          </span>
        ) : (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (!demo) recordClick({ productId: product._id as Id<"products"> }).catch(() => {})
            }}
            className={buttonVariants({ size: "lg", variant: "whatsapp", className: "shop-btn shop-action min-w-0 flex-1" })}
          >
            <MessageCircleIcon />
            <span className="truncate">{t(`orderLabels.${label}`)}</span>
          </a>
        )}
        <ShareButton name={product.name} url={shareUrl} className="shop-btn size-12 md:size-11" />
      </div>
    </div>
  )
}
