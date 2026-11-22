"use client"

import { useMutation, useQuery } from "convex/react"
import { MessageCircleIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import type { OrderLabel } from "../../../convex/lib/looks/buttonDesigns"
import { formatMoney, type Currency } from "../../../convex/lib/money"
import type { PublicSale } from "../../../convex/lib/sales/active"
import { SaleCountdown, SalePrice, SaleTags } from "./sale"
import { buttonVariants } from "@/components/ui/button"
import { productUrl } from "@/lib/site"
import { orderHref } from "@/lib/whatsapp"

function OptionChips({
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
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(value === option ? undefined : option)}
            className={cn(
              "shop-chip min-h-11 min-w-11 rounded-lg border px-3 text-sm font-medium transition-colors md:min-h-9",
              value === option ? "chip-selected" : "bg-card hover:bg-muted"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Price, size/colour choice and the "Order on WhatsApp" button. The click
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <SaleTags sale={sale} />
        <SalePrice price={normal} sale={sale} currency={currency} size="page" />
        {sale?.countdown ? <SaleCountdown endsAt={sale.endsAt} /> : null}
      </div>
      <OptionChips label={t("sizes")} options={product.sizes} value={size} onChange={setSize} />
      <OptionChips label={t("colors")} options={product.colors} value={color} onChange={setColor} />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        {product.soldOut ? (
          <span className={buttonVariants({ size: "lg", variant: "secondary", className: "shop-btn shop-action w-full cursor-not-allowed opacity-70" })} aria-disabled>
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
            className={buttonVariants({ size: "lg", variant: "whatsapp", className: "shop-btn shop-action w-full" })}
          >
            <MessageCircleIcon />
            {t(`orderLabels.${label}`)}
          </a>
        )}
      </div>
    </div>
  )
}
