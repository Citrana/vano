"use client"

import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { codeStatusAt } from "../../../../convex/lib/discountCodes/active"
import { LoadingState } from "@/components/states/states"
import { Card, CardTitle } from "@/components/ui/card"
import { useCodeLabels } from "@/features/discount-codes/use-code-labels"
import { useNow } from "@/features/shop-looks/editor/schedule-fields"
import { StatusTag } from "@/components/data-table/status-tag"
import { ModerateDialog } from "./moderate-dialog"

/** Pause or delete one code, with a required reason (logged, the seller is told). */
function ModerateCodeDialog({ codeId, code, action }: { codeId: Id<"discountCodes">; code: string; action: "pause" | "remove" }) {
  const t = useTranslations("AdminShops.discountCodes")
  const pause = useMutation(api.admin.discountCodes.pause)
  const remove = useMutation(api.admin.discountCodes.remove)
  return (
    <ModerateDialog
      action={action}
      title={action === "pause" ? t("pauseTitle", { code }) : t("deleteTitle", { code })}
      body={action === "pause" ? t("pauseBody") : t("deleteBody")}
      done={action === "pause" ? t("pausedDone") : t("deletedDone")}
      run={(reason) => (action === "pause" ? pause : remove)({ codeId, reason })}
    />
  )
}

/**
 * The shop drawer's discount codes card (CLAUDE.md "Discount codes"):
 * every saved code with its status, discount, products, dates and uses;
 * with `shops.manageDiscountCodes`, pause or delete with a reason (never
 * on the admin's own shop).
 */
export function ShopDiscountCodesCard({
  shopId,
  canManage,
  isOwnShop,
}: {
  shopId: Id<"shops">
  canManage: boolean
  isOwnShop: boolean
}) {
  const t = useTranslations("AdminShops.discountCodes")
  const ts = useTranslations("Sales")
  const now = useNow()
  const data = useQuery(api.admin.discountCodes.listForShop, { shopId })
  const labels = useCodeLabels(data?.currency ?? "USD")

  if (data === undefined) return <LoadingState className="py-6" />
  if (data === null) return null
  return (
    <Card className="gap-4">
      <CardTitle className="text-base">{t("title")}</CardTitle>
      {data.codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {data.codes.map((code) => {
            const status = codeStatusAt(code, now)
            return (
              <li key={code._id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-medium tracking-wide">{code.code}</span>
                  <StatusTag kind="discountCode" status={status} />
                </div>
                <p className="text-sm">
                  {labels.discount(code.discount)} · {ts("productCount", { count: code.products })}
                </p>
                <p className="text-xs text-muted-foreground">{labels.dates(code.startsAt, code.endsAt)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{labels.uses(code.uses, code.maxUses)}</p>
                {code.adminPause ? (
                  <p className="text-xs text-muted-foreground">{t("pausedBecause", { reason: code.adminPause.reason })}</p>
                ) : null}
                {canManage && !isOwnShop ? (
                  <div className="flex flex-wrap gap-2">
                    {status === "running" || status === "scheduled" ? (
                      <ModerateCodeDialog codeId={code._id} code={code.code} action="pause" />
                    ) : null}
                    <ModerateCodeDialog codeId={code._id} code={code.code} action="remove" />
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
