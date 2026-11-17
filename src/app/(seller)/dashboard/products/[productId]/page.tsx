"use client"

import { useMutation, useQuery } from "convex/react"
import { PackageXIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "../../../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { ProductForm } from "@/features/product/product-form"

export default function EditProductPage() {
  const t = useTranslations("ProductForm")
  const tc = useTranslations("Common")
  const { productId } = useParams<{ productId: string }>()
  const shop = useQuery(api.shops.myShop, {})
  const product = useQuery(api.products.getMine, { productId })
  const update = useMutation(api.products.update)
  const router = useRouter()

  if (shop === undefined || product === undefined) return <LoadingState />
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
      <PageTitle title={t("editTitle")} backHref="/dashboard" backLabel={tc("back")} />
      <ProductForm
        key={product._id}
        shop={shop}
        initial={product}
        onSubmit={async (values) => {
          await update({ productId: product._id, ...values })
          toast.success(t("saved"))
          router.push("/dashboard")
        }}
      />
    </div>
  )
}
