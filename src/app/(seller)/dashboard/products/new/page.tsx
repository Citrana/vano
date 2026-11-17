"use client"

import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "../../../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { LoadingState } from "@/components/states/states"
import { ProductForm } from "@/features/product/product-form"

export default function NewProductPage() {
  const t = useTranslations("ProductForm")
  const tc = useTranslations("Common")
  const shop = useQuery(api.shops.myShop, {})
  const create = useMutation(api.products.create)
  const router = useRouter()

  if (shop === undefined) return <LoadingState />
  if (shop === null) return null

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={t("newTitle")} backHref="/dashboard" backLabel={tc("back")} />
      <ProductForm
        shop={shop}
        onSubmit={async (values) => {
          await create(values)
          toast.success(t("created"))
          router.push("/dashboard")
        }}
      />
    </div>
  )
}
