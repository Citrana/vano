"use client"

import { useTranslations } from "next-intl"
import type { Currency } from "../../../convex/lib/money"
import { PERCENT_MAX, PERCENT_MIN } from "../../../convex/lib/sales/discount"
import type { DiscountKind } from "../../../convex/lib/sales/validators"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { ChoiceGroup } from "@/features/shop-looks/editor/choice-group"

/**
 * The discount, shared by the sale and discount code editors: the kind
 * (percent, amount off, or a set price for sales) and its value. Amounts
 * stay text and go through `MoneyInput` / `parseMoneyToMinor` (`toDiscount`).
 */
export function DiscountFields<K extends DiscountKind>({
  idPrefix,
  kinds,
  kind,
  value,
  onKindChange,
  onValueChange,
  error,
  currency,
}: {
  idPrefix: string
  kinds: readonly K[]
  kind: K
  value: string
  onKindChange: (kind: K) => void
  onValueChange: (value: string) => void
  error?: string
  currency: Currency
}) {
  const t = useTranslations("Sales.form")
  const kindLabels: Record<DiscountKind, string> = {
    percent: t("kind.percent"),
    amount: t("kind.amount"),
    price: t("kind.price"),
  }
  return (
    <>
      <ChoiceGroup<K>
        label={t("discountType")}
        value={kind}
        wrap
        onChange={(k) => {
          onKindChange(k)
          onValueChange("")
        }}
        options={kinds.map((k) => ({ value: k, label: kindLabels[k] }))}
      />
      <Field
        id={`${idPrefix}-value`}
        label={kind === "percent" ? t("percent") : kind === "amount" ? t("amount") : t("salePrice")}
        required
        help={kind === "percent" ? t("percentHelp", { min: PERCENT_MIN, max: PERCENT_MAX }) : t("amountHelp")}
        error={error}
      >
        {(p) =>
          kind === "percent" ? (
            <div className="relative">
              <Input
                {...p}
                inputMode="numeric"
                autoComplete="off"
                className="pr-10 tabular-nums"
                placeholder="30"
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
                %
              </span>
            </div>
          ) : (
            <MoneyInput {...p} currency={currency} placeholder="0" value={value} onChange={(e) => onValueChange(e.target.value)} />
          )
        }
      </Field>
    </>
  )
}
