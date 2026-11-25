"use client"

import { useLocale, useTranslations } from "next-intl"
import { formatMoney, type Currency } from "../../../convex/lib/money"
import type { RecordOffer } from "../../../convex/lib/salesRecords/validators"

/** Money, dates (in the shop's zone) and offers as the Sales page shows them. */
export function useRecordLabels(currency: Currency, timeZone: string) {
  const t = useTranslations("SalesRecords.details")
  const locale = useLocale()
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone })
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone })
  return {
    money: (minor: number) => formatMoney(minor, currency, locale),
    dateTime: (ms: number) => dateTime.format(ms),
    shortDate: (ms: number) => date.format(ms),
    offer: (offer: RecordOffer | null) =>
      offer === null
        ? t("none")
        : offer.kind === "sale"
          ? t("offerSale", { percent: offer.percent })
          : t("offerCode", { code: offer.code, percent: offer.percent }),
  }
}
