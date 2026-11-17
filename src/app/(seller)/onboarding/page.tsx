"use client"

import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import { Brand } from "@/components/shell/brand"
import { SellerGate } from "@/features/auth/gates"
import { SignOutButton } from "@/features/auth/sign-out-button"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"
import { ShopForm } from "@/features/shop/shop-form"

export default function OnboardingPage() {
  const t = useTranslations("Onboarding")
  const createShop = useMutation(api.shops.create)
  const router = useRouter()

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <Brand />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-10">
        <SellerGate need="noShop">
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
          <ShopForm
            mode="create"
            onSubmit={async (values) => {
              await createShop(values)
              toast.success(t("created"))
              router.replace("/dashboard")
            }}
          />
        </SellerGate>
      </main>
    </div>
  )
}
