"use client"

import { useMutation } from "convex/react"
import { MessageCircleIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { formatMoney, type Currency } from "../../../convex/lib/money"
import { buttonVariants } from "@/components/ui/button"
import { productUrl } from "@/lib/site"
import { buildOrderMessage, waChatLink } from "@/lib/whatsapp"

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
              "min-h-11 min-w-11 rounded-lg border px-3 text-sm font-medium transition-colors md:min-h-9",
              value === option ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
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
 * is recorded (anonymously) without delaying the link.
 */
export function OrderPanel({
  slug,
  whatsappNumber,
  currency,
  product,
}: {
  slug: string
  whatsappNumber: string
  currency: Currency
  product: { _id: string; name: string; price: number; sizes: string[]; colors: string[]; soldOut: boolean }
}) {
  const t = useTranslations("Public")
  const locale = useLocale()
  const recordClick = useMutation(api.stats.recordWhatsappClick)
  const [size, setSize] = useState<string>()
  const [color, setColor] = useState<string>()
  const price = formatMoney(product.price, currency, locale)
  const href = waChatLink(
    whatsappNumber,
    buildOrderMessage(t, { product: product.name, price, size, color, url: productUrl(slug, product._id) }),
  )

  return (
    <div className="flex flex-col gap-5">
      <p className="font-heading text-3xl font-semibold tabular-nums">{price}</p>
      <OptionChips label={t("sizes")} options={product.sizes} value={size} onChange={setSize} />
      <OptionChips label={t("colors")} options={product.colors} value={color} onChange={setColor} />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        {product.soldOut ? (
          <span className={buttonVariants({ size: "lg", variant: "secondary", className: "w-full cursor-not-allowed opacity-70" })} aria-disabled>
            {t("orderSoldOut")}
          </span>
        ) : (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              recordClick({ productId: product._id }).catch(() => {})
            }}
            className={buttonVariants({ size: "lg", variant: "whatsapp", className: "w-full" })}
          >
            <MessageCircleIcon />
            {t("order")}
          </a>
        )}
      </div>
    </div>
  )
}
