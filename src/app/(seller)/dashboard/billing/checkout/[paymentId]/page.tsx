"use client"

import { useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { PageTitle } from "@/components/shell/page-title"
import { CheckoutView } from "@/features/billing/checkout-view"

export default function CheckoutPage() {
  const t = useTranslations("Checkout")
  const tc = useTranslations("Common")
  const { paymentId } = useParams<{ paymentId: string }>()
  return (
    <div className="mx-auto w-full max-w-lg">
      <PageTitle title={t("title")} backHref="/dashboard/billing" backLabel={tc("back")} />
      <CheckoutView paymentId={paymentId} />
    </div>
  )
}
