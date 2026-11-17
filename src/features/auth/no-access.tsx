"use client"

import { LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { SignOutButton } from "./sign-out-button"

/** A signed-in account whose role opens neither the shop nor the admin. */
export function NoAccess() {
  const t = useTranslations("Auth")
  return (
    <div role="alert" className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <LockIcon className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-2xl font-bold tracking-tight">{t("noAccessTitle")}</h1>
      <p className="text-muted-foreground">{t("noAccessBody")}</p>
      <SignOutButton variant="outline" showLabel />
    </div>
  )
}
