"use client"

import { BanIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Brand } from "@/components/shell/brand"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"
import { SignOutButton } from "./sign-out-button"

/**
 * Shown instead of seller pages when the account is suspended. The server
 * refuses everything anyway (and signing in again); this explains why.
 * `header=false` where the page already has a top bar (onboarding).
 */
export function AccountSuspended({ header = true }: { header?: boolean }) {
  const t = useTranslations("Suspension")
  return (
    <div className="flex flex-1 flex-col">
      {header ? (
        <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Brand />
          <LanguageSwitcher />
        </header>
      ) : null}
      <main className="flex flex-1 items-start justify-center px-4 pt-10 pb-12 sm:items-center sm:pt-0">
        <div role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center">
          <BanIcon className="size-10 text-destructive" aria-hidden />
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t("accountTitle")}</h1>
          <p className="text-muted-foreground">{t("accountBody")}</p>
          <SignOutButton variant="outline" showLabel />
        </div>
      </main>
    </div>
  )
}
