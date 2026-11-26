"use client"

import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { Card } from "@/components/ui/card"
import { StatusTag } from "@/components/data-table/status-tag"
import { saleHref } from "./table-spec"
import { useRecordLabels } from "./use-record-labels"
import { useSalesAccess } from "./use-sales-access"

/** The product page's "Sales and history" card (Business, with `ownSales.manage`). */
export function ProductSalesHistory({ productId }: { productId: Id<"products"> }) {
  const access = useSalesAccess()
  if (!access.ready || !access.allowed || access.locked) return null
  return <HistoryCard productId={productId} />
}

function HistoryCard({ productId }: { productId: Id<"products"> }) {
  const history = useQuery(api.salesRecords.productHistory, { productId })
  if (history === undefined || history.locked) return null
  return <HistoryContent history={history} />
}

type History = Extract<NonNullable<ReturnType<typeof useQuery<typeof api.salesRecords.productHistory>>>, { locked: false }>

function HistoryContent({ history }: { history: History }) {
  const t = useTranslations("SalesRecords")
  const labels = useRecordLabels(history.currency, history.timeZone)
  const empty = history.sales.length === 0 && history.events.length === 0
  return (
    <Card className="mt-6 gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-bold">{t("history.title")}</h2>
        <Link href="/dashboard/sales" className="text-sm font-medium underline underline-offset-2 focus-ring">
          {t("history.seeAll")}
        </Link>
      </div>
      {empty ? <p className="text-sm text-muted-foreground">{t("history.empty")}</p> : null}
      {history.sales.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("history.sales")}</h3>
          <ul className="flex flex-col divide-y rounded-lg border">
            {history.sales.map((s) => (
              <li key={s._id}>
                <Link
                  href={saleHref(s)}
                  className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm hover:bg-muted focus-ring"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {labels.dateTime(s.soldAt)} · {t("row.quantity", { count: s.quantity })} · {t(`sources.${s.source}`)}
                  </span>
                  {s.status === "reversed" ? <StatusTag kind="salesRecord" status="reversed" /> : null}
                  <span className="font-semibold tabular-nums">{labels.money(s.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {history.events.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("history.events")}</h3>
          <ol className="flex flex-col gap-1.5 text-sm">
            {history.events.map((e) => (
              <li key={e._id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {t(`history.kinds.${e.kind}`)}
                  {e.by ? <span className="text-muted-foreground"> · {t("history.by", { name: e.by })}</span> : null}
                </span>
                <span className="shrink-0 text-muted-foreground">{labels.dateTime(e.at)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </Card>
  )
}
