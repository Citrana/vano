"use client"

import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { api } from "../../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { LoadingState } from "@/components/states/states"
import { ChangeRequestHistory } from "@/features/change-requests/change-request-history"
import { ProtectedField } from "@/features/change-requests/protected-field"
import { ShopForm } from "@/features/shop/shop-form"

export default function SettingsPage() {
  const t = useTranslations("Seller")
  const tf = useTranslations("ShopForm")
  const tc = useTranslations("Common")
  const shop = useQuery(api.shops.myShop, {})
  const products = useQuery(api.products.listMine, {})
  const update = useMutation(api.shops.update)
  const suspended = shop?.status === "suspended"

  if (shop === undefined || products === undefined) return <LoadingState />
  if (shop === null) return null

  const labels = { name: tf("name"), slug: tf("slug"), whatsapp: tf("whatsapp") } as const
  const current = { name: shop.name, slug: shop.slug, whatsapp: shop.whatsappNumber } as const

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageTitle title={t("settings")} backHref="/dashboard" backLabel={tc("back")} />
      <ShopForm
        key={shop._id}
        mode="edit"
        initialLogoUrl={shop.logoUrl}
        currencyLocked={products.length > 0}
        protectedField={(field) => (
          <ProtectedField
            field={field}
            label={labels[field]}
            current={current[field]}
            country={shop.country}
            disabled={suspended}
          />
        )}
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
          // Name, link and WhatsApp number only change through a request: not sent.
          await update({
            currency: values.currency,
            language: values.language,
            categories: values.categories,
            description: values.description,
            city: values.city,
            country: values.country,
            logoId: values.logoId,
            theme: values.theme,
          })
          toast.success(tf("saved"))
        }}
      />
      <ChangeRequestHistory />
    </div>
  )
}
