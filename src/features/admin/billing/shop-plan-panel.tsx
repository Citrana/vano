"use client"

import { useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { LoadingState } from "@/components/states/states"
import { Card, CardTitle } from "@/components/ui/card"
import { SubscriptionStatusBadge } from "@/features/billing/subscription-status-badge"
import { GrantPlanDialog } from "./grant-plan-dialog"
import { AdminPaymentsList } from "./payments-section"

/** The plan card on /admin/shops/[shopId]: status, recent payments, grant / extend. */
export function ShopPlanPanel({
  shopId,
  shopName,
  canManage,
  isOwnShop,
}: {
  shopId: Id<"shops">
  shopName: string
  canManage: boolean
  isOwnShop: boolean
}) {
  const t = useTranslations("AdminBilling")
  const tp = useTranslations("Pricing.plans")
  const format = useFormatter()
  const plan = useQuery(api.admin.billing.forShop, { shopId })

  if (plan === undefined) return <Card><LoadingState className="py-6" /></Card>
  if (plan === null) return null
  const running = plan.status === "trialing" || plan.status === "active"

  return (
    <Card aria-labelledby="shop-plan-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle id="shop-plan-title">{t("panelTitle")}</CardTitle>
        <SubscriptionStatusBadge status={plan.status} />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-bold">{tp(`${running ? plan.plan : "free"}.name`)}</p>
        {running && plan.periodEnd !== null ? (
          <p className="text-sm text-muted-foreground">
            {t("panelUntil", { date: format.dateTime(new Date(plan.periodEnd), { dateStyle: "long" }) })}
            {plan.source ? ` · ${t(`sources.${plan.source}`)}` : null}
          </p>
        ) : null}
      </div>

      {canManage ? (
        isOwnShop ? (
          <p className="text-sm text-muted-foreground">{t("ownShop")}</p>
        ) : (
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <GrantPlanDialog mode="grant" shopId={shopId} shopName={shopName} />
            {running ? (
              <GrantPlanDialog mode="extend" shopId={shopId} shopName={shopName} />
            ) : (
              <p className="text-xs text-muted-foreground">{t("cantExtendFree")}</p>
            )}
          </div>
        )
      ) : null}

      <div className="flex flex-col gap-2 border-t pt-4">
        <h3 className="text-sm font-semibold">{t("recentPayments")}</h3>
        {plan.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
        ) : (
          <AdminPaymentsList rows={plan.payments} showShop={false} />
        )}
      </div>
    </Card>
  )
}
