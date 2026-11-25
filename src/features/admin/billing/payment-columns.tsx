"use client"

import type { FunctionReturnType } from "convex/server"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { api } from "../../../../convex/_generated/api"
import { formatMoney } from "../../../../convex/lib/money"
import { StatusTag } from "@/components/data-table/status-tag"
import type { Column } from "@/components/data-table/types"
import { usePlanName } from "@/features/billing/use-plan-catalog"

export type AdminPaymentRow = FunctionReturnType<typeof api.admin.billing.payments>["page"][number]

/** Payment columns, shared by /admin/payments and a shop's plan panel (`showShop` off there). */
export function usePaymentColumns({ showShop }: { showShop: boolean }): Column<AdminPaymentRow>[] {
  const t = useTranslations("AdminBilling")
  const planName = usePlanName()
  const format = useFormatter()
  const locale = useLocale()
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium", timeStyle: "short" })
  const plan = (row: AdminPaymentRow) => planName(row.plan)

  const shop: Column<AdminPaymentRow>[] = showShop
    ? [{ id: "shop", header: t("shop"), cell: (r) => r.shopName, className: "max-w-52", mobile: "title" }]
    : []
  return [
    ...shop,
    {
      id: "date",
      header: t("date"),
      sortable: true,
      cell: (r) => date(r.createdAt),
      className: "whitespace-nowrap tabular-nums",
      mobile: showShop ? "meta" : "title",
    },
    { id: "plan", header: t("plan"), cell: plan, mobile: "subtitle" },
    {
      id: "amount",
      header: t("amount"),
      align: "end",
      cell: (r) => formatMoney(r.amountMinor, r.currency, locale),
      className: "whitespace-nowrap tabular-nums",
      mobile: "subtitle",
    },
    { id: "status", header: t("status"), cell: (r) => <StatusTag kind="payment" status={r.status} />, mobile: "trailing" },
    {
      id: "reference",
      header: t("reference"),
      muted: true,
      hideBelow: "xl",
      className: "max-w-48 text-xs",
      cell: (r) => (r.providerRef ? `${r.provider} · ${r.providerRef}` : r.provider),
    },
  ]
}
