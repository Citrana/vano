"use client"

import { useQuery } from "convex/react"
import { ReceiptIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo } from "react"
import { api } from "../../../../convex/_generated/api"
import { formatMoney } from "../../../../convex/lib/money"
import type { PlanId } from "../../../../convex/lib/plans"
import type { PaymentStatus } from "../../../../convex/payments/types"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { DataTable, TableBoundary } from "../data-table/data-table"
import { DetailItem, DetailList } from "../data-table/detail-list"
import { DetailsDrawer } from "../data-table/details-drawer"
import { filterDefs } from "../data-table/filters"
import { StatusTag } from "../data-table/status-tag"
import { TablePagination } from "../data-table/table-pagination"
import { TableToolbar } from "../data-table/table-toolbar"
import { useTablePages } from "../data-table/use-table-pages"
import { useTableState, type TableState } from "../data-table/use-table-state"
import { dayRange } from "../data-table/url-state"
import { useAdminViewer } from "../shell/use-admin-viewer"
import { adminHref } from "../shell/hrefs"
import { usePaymentColumns } from "./payment-columns"
import { PAYMENTS_SPEC } from "./table-spec"

/** /admin/payments: every plan payment, newest first. The URL can preset the filters (`?status=failed`). */
export function PaymentsSection() {
  const t = useTranslations("AdminBilling")
  const ts = useTranslations("Billing.paymentStatus")
  const tp = useTranslations("Pricing.plans")
  const filters = useMemo(
    () =>
      filterDefs(PAYMENTS_SPEC, {
        status: { label: t("status"), allLabel: t("allStatuses"), optionLabel: (s) => ts(s as PaymentStatus) },
        plan: { label: t("plan"), allLabel: t("allPlans"), optionLabel: (p) => tp(`${p as PlanId}.name`) },
        from: { label: t("date") },
      }),
    [t, ts, tp],
  )
  const table = useTableState(PAYMENTS_SPEC)

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("paymentsTitle")} />
      <TableToolbar table={table} filters={filters} search={{ label: t("search"), placeholder: t("searchPlaceholder") }} />
      <TableBoundary>
        <PaymentsTable table={table} />
      </TableBoundary>
      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("paymentTitle")}>
        {(id) => <PaymentDetails paymentId={id} />}
      </DetailsDrawer>
    </div>
  )
}

function PaymentsTable({ table }: { table: TableState }) {
  const t = useTranslations("AdminBilling")
  const columns = usePaymentColumns({ showShop: true })
  const { filters } = table
  const pages = useTablePages(
    api.admin.billing.payments,
    {
      search: table.search || undefined,
      plan: (filters.plan || undefined) as PlanId | undefined,
      status: (filters.status || undefined) as PaymentStatus | undefined,
      ...dayRange({ from: filters.from, to: filters.to }),
      order: table.search ? undefined : table.order,
    },
    table,
  )

  return (
    <DataTable
      label={t("paymentsTitle")}
      columns={columns}
      rows={pages.rows}
      getRowId={(r) => r._id}
      loading={pages.loading}
      skeletonRows={table.size}
      empty={{
        icon: <ReceiptIcon />,
        title: t("emptyPaymentsTitle"),
        body: table.filtered ? t("emptyFilteredBody") : t("emptyPaymentsBody"),
      }}
      onClearFilters={table.filtered ? table.clearFilters : undefined}
      onRowOpen={(r) => table.openRow(r._id)}
      activeRowId={table.open}
      sort={{ columnId: "date", order: table.order, onChange: table.setOrder, disabled: table.search !== "" }}
      footer={<TablePagination pages={pages} page={table.page} size={table.size} onPage={table.setPage} onSize={table.setSize} />}
    />
  )
}

/** The payment drawer: every field, and the way to the shop. */
function PaymentDetails({ paymentId }: { paymentId: string }) {
  const t = useTranslations("AdminBilling")
  const tp = useTranslations("Pricing.plans")
  const format = useFormatter()
  const locale = useLocale()
  const { viewer } = useAdminViewer()
  const payment = useQuery(api.admin.billing.payment, { paymentId })

  if (payment === undefined) return <LoadingState />
  if (payment === null) return <EmptyState icon={<ReceiptIcon />} title={t("paymentNotFoundTitle")} body={t("paymentNotFoundBody")} />
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium", timeStyle: "short" })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums">{formatMoney(payment.amountMinor, payment.currency, locale)}</p>
        <StatusTag kind="payment" status={payment.status} />
      </div>
      <DetailList className="rounded-xl border bg-card p-4">
        <DetailItem label={t("shop")}>{payment.shopName}</DetailItem>
        <DetailItem label={t("plan")}>{tp(`${payment.plan}.name`)}</DetailItem>
        <DetailItem label={t("date")}>{date(payment.createdAt)}</DetailItem>
        <DetailItem label={t("completed")}>{payment.completedAt ? date(payment.completedAt) : "—"}</DetailItem>
        <DetailItem label={t("provider")}>{payment.provider}</DetailItem>
        <DetailItem label={t("reference")}>{payment.providerRef ?? "—"}</DetailItem>
      </DetailList>
      {viewer?.permissions.includes("shops.view") ? (
        <Link href={adminHref.shop(payment.shopId)} className="self-start text-sm font-medium hover:underline">
          {t("openShop")}
        </Link>
      ) : null}
    </>
  )
}
