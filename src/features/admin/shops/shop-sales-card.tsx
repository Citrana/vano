"use client"

import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { saleStatusAt } from "../../../../convex/lib/sales/active"
import { LoadingState } from "@/components/states/states"
import { Card, CardTitle } from "@/components/ui/card"
import { useSaleLabels } from "@/features/sales/use-sale-labels"
import { useNow } from "@/features/shop-looks/editor/schedule-fields"
import { StatusTag } from "@/components/data-table/status-tag"
import { ModerateDialog } from "./moderate-dialog"

/** Pause or delete one sale, with a required reason (logged, the seller is told). */
function ModerateSaleDialog({ saleId, name, action }: { saleId: Id<"sales">; name: string; action: "pause" | "remove" }) {
  const t = useTranslations("AdminShops.sales")
  const pause = useMutation(api.admin.sales.pause)
  const remove = useMutation(api.admin.sales.remove)
  return (
    <ModerateDialog
      action={action}
      title={action === "pause" ? t("pauseTitle", { name }) : t("deleteTitle", { name })}
      body={action === "pause" ? t("pauseBody") : t("deleteBody")}
      done={action === "pause" ? t("pausedDone") : t("deletedDone")}
      run={(reason) => (action === "pause" ? pause : remove)({ saleId, reason })}
    />
  )
}

/**
 * The shop drawer's sales card (CLAUDE.md "Sales"): every saved sale with
 * its status, discount, products and numbers; with `shops.manageSales`,
 * pause or delete with a reason (never on the admin's own shop).
 */
export function ShopSalesCard({ shopId, canManage, isOwnShop }: { shopId: Id<"shops">; canManage: boolean; isOwnShop: boolean }) {
  const t = useTranslations("AdminShops.sales")
  const ts = useTranslations("Sales")
  const now = useNow()
  const data = useQuery(api.admin.sales.listForShop, { shopId })
  const labels = useSaleLabels(data?.currency ?? "USD")

  if (data === undefined) return <LoadingState className="py-6" />
  if (data === null) return null
  return (
    <Card className="gap-4">
      <CardTitle className="text-base">{t("title")}</CardTitle>
      {data.sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {data.sales.map((sale) => {
            const status = saleStatusAt(sale, now)
            return (
              <li key={sale._id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{sale.name}</span>
                  <StatusTag kind="sale" status={status} />
                </div>
                <p className="text-sm">
                  {labels.discount(sale.discount)} · {ts("productCount", { count: sale.products })}
                </p>
                <p className="text-xs text-muted-foreground">{labels.dates(sale.startsAt, sale.endsAt)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {ts("statsLine", { views: sale.views, clicks: sale.whatsappClicks })}
                </p>
                {sale.adminPause ? (
                  <p className="text-xs text-muted-foreground">{t("pausedBecause", { reason: sale.adminPause.reason })}</p>
                ) : null}
                {canManage && !isOwnShop ? (
                  <div className="flex flex-wrap gap-2">
                    {status === "running" || status === "scheduled" ? (
                      <ModerateSaleDialog saleId={sale._id} name={sale.name} action="pause" />
                    ) : null}
                    <ModerateSaleDialog saleId={sale._id} name={sale.name} action="remove" />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {canManage && isOwnShop ? <p className="text-xs text-muted-foreground">{t("ownShop")}</p> : null}
    </Card>
  )
}
