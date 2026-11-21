"use client"

import { useMutation, usePaginatedQuery } from "convex/react"
import { ReceiptIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { formatMoney } from "../../../convex/lib/money"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { useErrorMessage } from "@/lib/use-error-message"
import { PaymentStatusBadge } from "./payment-status-badge"
import { usePlanName } from "@/features/billing/use-plan-catalog"

const PAGE = 10

/** Date, plan, amount, status. In test mode, pending rows can be completed or failed. */
export function PaymentHistory({ testMode }: { testMode: boolean }) {
  const t = useTranslations("Billing")
  const planName = usePlanName()
  const format = useFormatter()
  const locale = useLocale()
  const { results, status, loadMore } = usePaginatedQuery(api.billing.payments, {}, { initialNumItems: PAGE })

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h2 id="history-title" className="font-heading text-lg font-bold tracking-tight">
        {t("historyTitle")}
      </h2>
      {status === "LoadingFirstPage" ? (
        <LoadingState />
      ) : results.length === 0 ? (
        <EmptyState icon={<ReceiptIcon />} title={t("historyEmptyTitle")} body={t("historyEmptyBody")} />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {results.map((p) => (
            <li key={p._id} className="flex flex-col gap-2 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col">
                <p className="font-medium">{planName(p.plan)}</p>
                <time dateTime={new Date(p.createdAt).toISOString()} className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(p.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">{formatMoney(p.amountMinor, p.currency, locale)}</span>
                <PaymentStatusBadge status={p.status} />
              </div>
              {testMode && p.status === "pending" && p.provider === "mock" ? <TestControls paymentId={p._id} /> : null}
            </li>
          ))}
        </ul>
      )}
      {status === "CanLoadMore" ? (
        <Button variant="outline" className="self-center" onClick={() => loadMore(PAGE)}>
          {t("loadMore")}
        </Button>
      ) : null}
    </section>
  )
}

/** Development only: finishes a pending mock payment (the server re-checks test mode). */
export function TestControls({ paymentId }: { paymentId: Id<"payments"> }) {
  const t = useTranslations("Billing")
  const simulate = useMutation(api.billing.mockSimulate)
  const errorMessage = useErrorMessage()
  const run = (outcome: "succeeded" | "failed") =>
    simulate({ paymentId, outcome }).catch((error) => toast.error(errorMessage(error)))
  return (
    <div className="flex gap-2 sm:basis-full sm:justify-end">
      <Button size="sm" variant="secondary" onClick={() => run("succeeded")}>
        {t("testComplete")}
      </Button>
      <Button size="sm" variant="destructive" onClick={() => run("failed")}>
        {t("testFail")}
      </Button>
    </div>
  )
}
