"use client"

import { useMutation, useQuery } from "convex/react"
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
import { WhatsAppIcon } from "./whatsapp-icon"
import { buttonVariants } from "@/components/ui/button"
import { productUrl } from "@/lib/site"
import { useVisitorId } from "@/lib/visitor-id"
import { orderHref } from "@/lib/whatsapp"
import type { CodeProblem } from "../../../convex/lib/discountCodes/validators"
import { DiscountCodeField, type AppliedCode } from "./discount-code-field"

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
 *
 * Discount codes (CLAUDE.md "Discount codes"): the field shows while a
 * live code applies (`codeField`, live too). With a code applied, tapping
 * Order opens the WhatsApp tab at once (so it isn't blocked), asks the
 * server to redeem the code (re-checked, maximum enforced, one use
 * counted) and sends the message with the price the server returned.
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
    /** Show "Have a discount code?" (server-rendered; then live). */
    codeField?: boolean
    /** The seller's product code, for the WhatsApp message. */
    code?: string | null
  }
}) {
  const t = useTranslations("Public")
  const locale = useLocale()
  const recordClick = useMutation(api.stats.recordWhatsappClick)
  const live = useQuery(api.public.productPrice, demo ? "skip" : { productId: product._id })
  const [size, setSize] = useState<string>()
  const [color, setColor] = useState<string>()
  const redeem = useMutation(api.public.redeemDiscountCode)
  const visitorId = useVisitorId()
  const [code, setCode] = useState<AppliedCode | null>(null)
  const [codeProblem, setCodeProblem] = useState<CodeProblem | "failed" | null>(null)
  // The server-rendered values until the live ones arrive.
  const normal = live?.price ?? product.price
  const sale = live === undefined || live === null ? (product.sale ?? null) : live.sale
  const codeField = !demo && (live === undefined || live === null ? product.codeField === true : live.codeField)
  // Live too: the last piece may sell while the page is open.
  const soldOut = product.soldOut || live?.soldOut === true
  // A code stops showing as soon as the field goes (code ended, plan changed).
  const applied = codeField ? code : null

  const hrefFor = (deal: { price: number; original?: number; code?: string } | null) =>
    orderHref(t, {
      product: product.name,
      productCode: product.code,
      price: formatMoney(deal ? deal.price : normal, currency, locale),
      normalPrice: deal?.original !== undefined ? formatMoney(deal.original, currency, locale) : undefined,
      code: deal?.code,
      size,
      color,
      url: productUrl(slug, product._id),
      whatsappNumber,
      demo,
      demoNote: t("demoOrderNote"),
    })
  const saleDeal = sale ? { price: sale.price, original: sale.original } : null
  const href = hrefFor(applied ?? saleDeal)

  async function orderWithCode(appliedCode: AppliedCode) {
    // Open the tab inside the tap, then point it at the final message.
    const tab = window.open("about:blank", "_blank")
    if (tab) tab.opener = null
    const go = (url: string) => {
      if (tab) tab.location.href = url
      else window.location.href = url
    }
    try {
      const result = await redeem({ productId: product._id, code: appliedCode.code, visitorId: visitorId() })
      if (result.status === "applied") {
        setCode(result)
        go(hrefFor(result))
      } else if (result.status === "saleBetter") {
        setCode(null)
        setCodeProblem("saleBetter")
        go(hrefFor(saleDeal))
      } else {
        tab?.close()
        setCode(null)
        setCodeProblem(result.status)
      }
    } catch {
      tab?.close()
      setCodeProblem("failed")
    }
  }

  const shareUrl = () => (demo ? `${window.location.origin}/demo/${product._id}` : productUrl(slug, product._id))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SalePrice price={normal} sale={applied ?? sale} currency={currency} size="page" />
        {applied ? null : <SaleTags sale={sale} />}
        {!applied && sale?.countdown ? <SaleCountdown endsAt={sale.endsAt} /> : null}
      </div>
      <SizeChips label={t("sizes")} options={product.sizes} value={size} onChange={setSize} />
      <ColorDots label={t("colors")} options={product.colors} value={color} onChange={setColor} />
      {codeField && !soldOut ? (
        <DiscountCodeField
          productId={product._id}
          visitorId={visitorId}
          applied={applied}
          onApply={(result) => {
            setCode(result)
            setCodeProblem(null)
          }}
          onRemove={() => setCode(null)}
          problem={codeProblem}
          onProblem={setCodeProblem}
        />
      ) : null}
      {/* Phones: a fixed bar, so ordering is always one tap away (the page leaves room for it). */}
      <div className="fixed inset-x-0 bottom-[var(--bottom-bar,0px)] z-30 flex gap-2 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        {soldOut ? (
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
            onClick={(event) => {
              if (!demo) recordClick({ productId: product._id as Id<"products"> }).catch(() => {})
              if (applied) {
                event.preventDefault()
                void orderWithCode(applied)
              }
            }}
            className={buttonVariants({ size: "lg", variant: "whatsapp", className: "shop-btn shop-action min-w-0 flex-1" })}
          >
            <WhatsAppIcon />
            <span className="truncate">{t(`orderLabels.${label}`)}</span>
          </a>
        )}
        <ShareButton name={product.name} url={shareUrl} className="shop-btn size-12 md:size-11" />
      </div>
    </div>
  )
}
