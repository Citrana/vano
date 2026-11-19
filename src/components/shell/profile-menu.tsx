"use client"

import { LogOutIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import { LANGUAGES, type Language } from "../../../convex/lib/catalog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSignOut } from "@/features/auth/sign-out-button"
import { useChangeLocale } from "@/features/i18n/language-switcher"

/** Avatar button with the account email, language choice and sign out. */
export function ProfileMenu({ email }: { email: string | null }) {
  const t = useTranslations("Seller")
  const tc = useTranslations("Common")
  const tl = useTranslations("Languages")
  const { locale, choose, pending } = useChangeLocale()
  const signOut = useSignOut()
  const initial = email?.trim().charAt(0).toUpperCase() || "?"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("profileMenu")}
        className="flex size-11 items-center justify-center rounded-full focus-ring md:size-9"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-9 items-center justify-center rounded-full bg-foreground font-heading text-sm font-bold text-background md:size-8",
            pending && "opacity-60",
          )}
        >
          {initial}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {email ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("account")}</DropdownMenuLabel>
              <p className="truncate px-2.5 pb-2 text-sm font-medium" title={email}>
                {email}
              </p>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tc("language")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={locale} onValueChange={(value) => choose(value as Language)}>
            {LANGUAGES.map((lang) => (
              <DropdownMenuRadioItem key={lang} value={lang} lang={lang} closeOnClick>
                {tl(lang)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOutIcon />
          {tc("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
