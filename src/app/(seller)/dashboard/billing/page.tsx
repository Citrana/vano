"use client"

import { useQuery } from "convex/react"
import { LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { use } from "react"
import { api } from "../../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { CurrentPlanCard } from "@/features/billing/current-plan-card"
import { PaymentHistory } from "@/features/billing/payment-history"
import { PlanOptions } from "@/features/billing/plan-options"
import { startPlanParam } from "@/features/billing/start-plan"
import { useMyBilling, useNow } from "@/features/billing/use-billing"

export default function BillingPage({ searchParams }: { searchParams: Promise<{ upgrade?: string | string[] }> }) {
  // "Get Business" (pricing page / sign-up) opens the Business payment dialog.
  const upgrade = startPlanParam(use(searchParams).upgrade)
  const t = useTranslations("Billing")
  const te = useTranslations("Errors")
  const shop = useQuery(api.shops.myShop, {})
  const billing = useMyBilling()
  const now = useNow()

  if (shop === undefined || billing === undefined) return <LoadingState />
  if (shop === null) return null // SellerGate redirects to onboarding
  if (billing === null) return <EmptyState icon={<LockIcon />} title={te("FORBIDDEN")} />

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t("title")} />
      {billing.openPaymentId ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary p-3 text-sm">
          <span>{t("openPayment")}</span>
          <Link
            href={`/dashboard/billing/checkout/${billing.openPaymentId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("openPaymentLink")}
          </Link>
        </div>
      ) : null}
      <CurrentPlanCard billing={billing} now={now} />
      <PlanOptions billing={billing} shopName={shop.name} now={now} initialPlan={upgrade ?? null} />
      <PaymentHistory testMode={billing.payments.testMode} />
    </div>
  )
}
