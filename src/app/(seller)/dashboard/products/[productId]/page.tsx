"use client"

import { useMutation, useQuery } from "convex/react"
import { EyeOffIcon, PackageXIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "../../../../../../convex/_generated/api"
import { photoCap, toPlanLimits } from "../../../../../../convex/lib/planFeatures"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { useMyBilling } from "@/features/billing/use-billing"
import { ProductForm } from "@/features/product/product-form"
import { MarkSoldButton } from "@/features/sales-records/mark-sold-button"
import { ProductSalesHistory } from "@/features/sales-records/product-sales-history"

export default function EditProductPage() {
  const t = useTranslations("ProductForm")
  const tc = useTranslations("Common")
  const { productId } = useParams<{ productId: string }>()
  const shop = useQuery(api.shops.myShop, {})
  const product = useQuery(api.products.getMine, { productId })
  const billing = useMyBilling()
  const update = useMutation(api.products.update)
  const router = useRouter()

  if (shop === undefined || product === undefined || billing === undefined) return <LoadingState />
  if (shop === null) return null
  if (product === null) {
    return (
      <EmptyState
        className="mx-auto max-w-2xl"
        icon={<PackageXIcon />}
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        action={
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            {t("backToDashboard")}
          </Link>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title={t("editTitle")}
        backHref="/dashboard/products"
        backLabel={tc("back")}
        action={<MarkSoldButton productId={product._id} />}
      />
      {product.hidden ? (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
          <EyeOffIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          {t("hiddenNotice")}
        </p>
      ) : null}
      <ProductForm
        key={product._id}
        shop={shop}
        initial={product}
        // A product with more photos than the plan allows keeps them (never gains more).
        maxImages={billing ? photoCap(toPlanLimits(billing.limits), product.imageIds.length) : undefined}
        onSubmit={async (values) => {
          await update({ productId: product._id, ...values })
          toast.success(t("saved"))
          router.push("/dashboard/products")
        }}
      />
      <ProductSalesHistory productId={product._id} />
    </div>
  )
}
