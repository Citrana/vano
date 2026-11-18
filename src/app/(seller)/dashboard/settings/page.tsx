"use client"

import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { api } from "../../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { LoadingState } from "@/components/states/states"
import { ShopForm } from "@/features/shop/shop-form"

export default function SettingsPage() {
  const t = useTranslations("Seller")
  const tf = useTranslations("ShopForm")
  const tc = useTranslations("Common")
  const shop = useQuery(api.shops.myShop, {})
  const update = useMutation(api.shops.update)

  if (shop === undefined) return <LoadingState />
  if (shop === null) return null

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={t("settings")} backHref="/dashboard" backLabel={tc("back")} />
      <ShopForm
        key={shop._id}
        mode="edit"
        initialLogoUrl={shop.logoUrl}
        initial={{
          name: shop.name,
          slug: shop.slug,
          currency: shop.currency,
          language: shop.language,
          categories: shop.categories,
          description: shop.description ?? "",
          whatsappNumber: shop.whatsappNumber,
          city: shop.city,
          country: shop.country,
          logoId: shop.logoId,
          theme: shop.theme,
        }}
        onSubmit={async (values) => {
          await update(values)
          toast.success(tf("saved"))
        }}
      />
    </div>
  )
}
