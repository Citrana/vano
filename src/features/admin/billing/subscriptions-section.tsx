"use client"

import { usePaginatedQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ChevronRightIcon, CreditCardIcon, Loader2Icon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "../../../../convex/lib/plans"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { SubscriptionStatusBadge } from "@/features/billing/subscription-status-badge"
import { useDebounced } from "@/lib/use-debounced"
import { BillingFilters, dayRange, type BillingFilterValue } from "./billing-filters"
import { billingFiltersFromParams } from "./filter-params"

const PAGE_SIZE = 20
type Row = FunctionReturnType<typeof api.admin.billing.subscriptions>["page"][number]

/** /admin/subscriptions: every shop's plan, soonest ending first. The URL can preset the filters (`?from=&to=`). */
export function SubscriptionsSection() {
  const params = useSearchParams()
  return <SubscriptionsView key={params.toString()} initial={billingFiltersFromParams(params, SUBSCRIPTION_STATUSES)} />
}

function SubscriptionsView({ initial }: { initial: BillingFilterValue<SubscriptionStatus> }) {
  const t = useTranslations("AdminBilling")
  const ts = useTranslations("Billing.status")
  const [filters, setFilters] = useState<BillingFilterValue<SubscriptionStatus>>(initial)
  const search = useDebounced(filters.search.trim())
  const range = dayRange(filters)
  const filtered = Object.values(filters).some((v) => v !== "")
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.billing.subscriptions,
    {
      search: search || undefined,
      plan: filters.plan || undefined,
      status: filters.status || undefined,
      endsFrom: range.from,
      endsTo: range.to,
    },
    { initialNumItems: PAGE_SIZE },
  )

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("subscriptionsTitle")} />
      <BillingFilters
        value={filters}
        onChange={setFilters}
        statuses={SUBSCRIPTION_STATUSES}
        statusLabel={(s) => ts(s)}
        fromLabel={t("endsFrom")}
        toLabel={t("endsTo")}
      />
      {status === "LoadingFirstPage" ? (
        <LoadingState />
      ) : results.length === 0 && status === "Exhausted" ? (
        <EmptyState
          icon={<CreditCardIcon />}
          title={t("emptySubscriptionsTitle")}
          body={filtered ? t("emptyFilteredBody") : t("emptySubscriptionsBody")}
        />
      ) : (
        <>
          {results.length > 0 ? <SubscriptionsList rows={results} /> : null}
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

function SubscriptionsList({ rows }: { rows: Row[] }) {
  const t = useTranslations("AdminBilling")
  const tp = useTranslations("Pricing.plans")
  const format = useFormatter()
  const ends = (row: Row) => (row.periodEnd === null ? t("noEnd") : format.dateTime(new Date(row.periodEnd), { dateStyle: "medium" }))

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row._id}>
            <Link href={`/admin/shops/${row.shopId}`} className="flex min-h-11 items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{row.shopName}</span>
                  <SubscriptionStatusBadge status={row.status} />
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {tp(`${row.plan}.name`)} · {t("ends")}: {ends(row)} · {t(`sources.${row.source}`)}
                </span>
              </div>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">{t("shop")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("plan")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("status")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("ends")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("source")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row._id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/shops/${row.shopId}`} className="font-medium hover:underline">{row.shopName}</Link>
                </td>
                <td className="px-4 py-2.5">{tp(`${row.plan}.name`)}</td>
                <td className="px-4 py-2.5"><SubscriptionStatusBadge status={row.status} /></td>
                <td className="px-4 py-2.5 tabular-nums">{ends(row)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{t(`sources.${row.source}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
