"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { formatMoney, type Currency } from "../../../convex/lib/money"
import type { SaleStatus } from "../../../convex/lib/sales/active"
import type { SaleDiscount } from "../../../convex/lib/sales/validators"

/** Words for a sale in the seller's language: discount, dates, status. */
export function useSaleLabels(currency: Currency) {
  const t = useTranslations("Sales")
  const locale = useLocale()
  const format = useFormatter()
  return {
    discount: (d: SaleDiscount) =>
      d.kind === "percent"
        ? t("discount.percentOff", { percent: d.value })
        : d.kind === "amount"
          ? t("discount.amountOff", { amount: formatMoney(d.value, currency, locale) })
          : t("discount.setPrice", { price: formatMoney(d.value, currency, locale) }),
    dates: (startsAt: number, endsAt: number) =>
      t("dates", {
        start: format.dateTime(new Date(startsAt), { dateStyle: "medium", timeStyle: "short" }),
        end: format.dateTime(new Date(endsAt), { dateStyle: "medium", timeStyle: "short" }),
      }),
    when: (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium", timeStyle: "short" }),
    status: (s: SaleStatus) => t(`status.${s}`),
    money: (minor: number) => formatMoney(minor, currency, locale),
  }
}
