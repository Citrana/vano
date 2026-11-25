"use client"

import type { FunctionReturnType } from "convex/server"
import { ImageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import type { api } from "../../../convex/_generated/api"
import type { Currency } from "../../../convex/lib/money"
import { StatusTag } from "@/components/data-table/status-tag"
import type { Column } from "@/components/data-table/types"
import { useRecordLabels } from "./use-record-labels"

type ListResult = Extract<FunctionReturnType<typeof api.salesRecords.listMine>, { locked: false }>
export type SaleRecordRow = ListResult["rows"][number]

/** The Sales page columns (the shared `DataTable`); customer only when the viewer may see it. */
export function useSaleColumns({
  currency,
  timeZone,
  canSeeCustomers,
}: {
  currency: Currency
  timeZone: string
  canSeeCustomers: boolean
}): Column<SaleRecordRow>[] {
  const t = useTranslations("SalesRecords")
  const labels = useRecordLabels(currency, timeZone)
  const customer: Column<SaleRecordRow>[] = canSeeCustomers
    ? [{ id: "customer", header: t("details.customer"), muted: true, hideBelow: "xl", className: "max-w-40", cell: (r) => r.customerName ?? "—" }]
    : []
  return [
    {
      id: "product",
      header: t("details.product"),
      className: "max-w-64",
      mobile: "title",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="size-8 shrink-0 overflow-hidden rounded-sm bg-muted">
            {r.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
              <img src={r.photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-3.5" aria-hidden />
              </span>
            )}
          </span>
          <span className="truncate">{r.productName}</span>
        </span>
      ),
    },
    {
      id: "date",
      header: t("details.soldAt"),
      sortable: true,
      className: "whitespace-nowrap tabular-nums",
      mobile: "meta",
      cell: (r) => labels.dateTime(r.soldAt),
    },
    {
      id: "options",
      header: t("details.options"),
      muted: true,
      hideBelow: "lg",
      cell: (r) => [r.size, r.color].filter(Boolean).join(" · ") || "—",
    },
    {
      id: "quantity",
      header: t("details.quantity"),
      align: "end",
      className: "tabular-nums",
      mobile: "subtitle",
      cell: (r) => t("row.quantity", { count: r.quantity }),
    },
    { id: "source", header: t("details.source"), mobile: "meta", cell: (r) => t(`sources.${r.source}`) },
    {
      id: "total",
      header: t("details.total"),
      align: "end",
      className: "whitespace-nowrap tabular-nums",
      mobile: "subtitle",
      cell: (r) => (
        <span className={cn("font-semibold", r.status === "reversed" && "text-muted-foreground line-through")}>
          {labels.money(r.total)}
        </span>
      ),
    },
    { id: "status", header: t("details.status"), mobile: "trailing", cell: (r) => <StatusTag kind="salesRecord" status={r.status} /> },
    ...customer,
  ]
}
