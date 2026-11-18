"use client"

import { useMutation, useQuery } from "convex/react"
import { PackageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "../../../../../../convex/_generated/api"
import { canShopDo } from "../../../../../../convex/lib/entitlements"
import { PLAN_LIMITS, photoCap } from "../../../../../../convex/lib/plans"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { useMyBilling } from "@/features/billing/use-billing"
import { ProductForm } from "@/features/product/product-form"

export default function NewProductPage() {
  const t = useTranslations("ProductForm")
  const td = useTranslations("Dashboard")
  const tc = useTranslations("Common")
  const shop = useQuery(api.shops.myShop, {})
  const billing = useMyBilling()
  const create = useMutation(api.products.create)
  const router = useRouter()

  if (shop === undefined || billing === undefined) return <LoadingState />
  if (shop === null) return null

  // The plan's limits (the server checks again on save).
  const limits = billing ? PLAN_LIMITS[billing.effectivePlan] : null
  if (billing && limits && canShopDo(limits, { kind: "addProduct", products: billing.usage.products }) !== null) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle title={t("newTitle")} backHref="/dashboard" backLabel={tc("back")} />
        <EmptyState
          icon={<PackageIcon />}
          title={td("limitReached", { count: limits.products ?? 0 })}
          action={
            <Link href="/dashboard/billing" className={buttonVariants()}>
              {td("upgrade")}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={t("newTitle")} backHref="/dashboard" backLabel={tc("back")} />
      <ProductForm
        shop={shop}
        maxImages={limits ? photoCap(limits) : undefined}
        onSubmit={async (values) => {
          await create(values)
          toast.success(t("created"))
          router.push("/dashboard")
        }}
      />
    </div>
  )
}
