"use client"

import { usePaginatedQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Loader2Icon, ReceiptIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { formatMoney } from "../../../../convex/lib/money"
import { PAYMENT_STATUSES, type PaymentStatus } from "../../../../convex/payments/types"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { PaymentStatusBadge } from "@/features/billing/payment-status-badge"
import { useDebounced } from "@/lib/use-debounced"
import { BillingFilters, dayRange, emptyFilters, type BillingFilterValue } from "./billing-filters"

const PAGE_SIZE = 25
export type AdminPaymentRow = FunctionReturnType<typeof api.admin.billing.payments>["page"][number]

/** /admin/payments: every plan payment, newest first. */
export function PaymentsSection() {
  const t = useTranslations("AdminBilling")
  const ts = useTranslations("Billing.paymentStatus")
  const [filters, setFilters] = useState<BillingFilterValue<PaymentStatus>>(emptyFilters)
  const search = useDebounced(filters.search.trim())
  const range = dayRange(filters)
  const filtered = Object.values(filters).some((v) => v !== "")
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.billing.payments,
    {
      search: search || undefined,
      plan: filters.plan || undefined,
      status: filters.status || undefined,
      from: range.from,
      to: range.to,
    },
    { initialNumItems: PAGE_SIZE },
  )

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("paymentsTitle")} />
      <BillingFilters
        value={filters}
        onChange={setFilters}
        statuses={PAYMENT_STATUSES}
        statusLabel={(s) => ts(s)}
        fromLabel={t("from")}
        toLabel={t("to")}
      />
      {status === "LoadingFirstPage" ? (
        <LoadingState />
      ) : results.length === 0 && status === "Exhausted" ? (
        <EmptyState
          icon={<ReceiptIcon />}
          title={t("emptyPaymentsTitle")}
          body={filtered ? t("emptyFilteredBody") : t("emptyPaymentsBody")}
        />
      ) : (
        <>
          {results.length > 0 ? <AdminPaymentsList rows={results} /> : null}
          {status !== "Exhausted" ? (
            <Button variant="outline" className="self-center" disabled={status === "LoadingMore"} onClick={() => loadMore(PAGE_SIZE)}>
              {status === "LoadingMore" ? <Loader2Icon className="animate-spin" /> : null}
              {t("loadMore")}
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}

/** Cards on phones, a table from `md`. `showShop` is off inside a shop's page. */
export function AdminPaymentsList({ rows, showShop = true }: { rows: AdminPaymentRow[]; showShop?: boolean }) {
  const t = useTranslations("AdminBilling")
  const tp = useTranslations("Pricing.plans")
  const format = useFormatter()
  const locale = useLocale()
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium", timeStyle: "short" })
  const amount = (row: AdminPaymentRow) => formatMoney(row.amountMinor, row.currency, locale)
  const shopLink = (row: AdminPaymentRow) => (
    <Link href={`/admin/shops/${row.shopId}`} className="font-medium hover:underline">{row.shopName}</Link>
  )

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row._id} className="flex flex-col gap-1 rounded-xl border bg-card p-3">
            <span className="flex flex-wrap items-center justify-between gap-2">
              {showShop ? shopLink(row) : <span className="font-medium">{tp(`${row.plan}.name`)}</span>}
              <PaymentStatusBadge status={row.status} />
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {showShop ? `${tp(`${row.plan}.name`)} · ` : null}
              {amount(row)}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {date(row.createdAt)} · {row.provider}
              {row.providerRef ? ` · ${row.providerRef}` : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">{t("date")}</th>
              {showShop ? <th scope="col" className="px-4 py-2 font-medium">{t("shop")}</th> : null}
              <th scope="col" className="px-4 py-2 font-medium">{t("plan")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("amount")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("status")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("reference")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row._id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{date(row.createdAt)}</td>
                {showShop ? <td className="px-4 py-2.5">{shopLink(row)}</td> : null}
                <td className="px-4 py-2.5">{tp(`${row.plan}.name`)}</td>
                <td className="px-4 py-2.5 tabular-nums">{amount(row)}</td>
                <td className="px-4 py-2.5"><PaymentStatusBadge status={row.status} /></td>
                <td className="max-w-48 truncate px-4 py-2.5 text-xs text-muted-foreground">
                  {row.provider}
                  {row.providerRef ? ` · ${row.providerRef}` : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
