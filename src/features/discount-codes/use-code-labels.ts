"use client"

import { useTranslations } from "next-intl"
import type { CodeStatus } from "../../../convex/lib/discountCodes/active"
import type { Currency } from "../../../convex/lib/money"
import type { SaleTarget } from "../../../convex/lib/sales/validators"
import { useSaleLabels } from "@/features/sales/use-sale-labels"

/**
 * Words for a discount code in the seller's language: the sale labels
 * (discount, dates, money) plus status, where it applies and uses.
 */
export function useCodeLabels(currency: Currency) {
  const t = useTranslations("DiscountCodes")
  const tc = useTranslations("Categories")
  const sale = useSaleLabels(currency)
  return {
    ...sale,
    status: (s: CodeStatus) => t(`status.${s}`),
    where: (target: SaleTarget, products: number) =>
      target.kind === "shop"
        ? t("where.shop")
        : target.kind === "category"
          ? t("where.category", { category: tc(target.category) })
          : t("where.products", { count: products }),
    uses: (uses: number, maxUses: number | null) =>
      maxUses === null ? t("usesCount", { count: uses }) : t("usesOf", { uses, max: maxUses }),
  }
}
