"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { cn } from "cn"
import { LANGUAGES, type Language } from "../../../convex/lib/catalog"
import { LOCALE_COOKIE } from "@/i18n/locale"

function saveLocaleCookie(locale: Language) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
}

/** The current UI language and a setter that saves the cookie and re-renders. */
export function useChangeLocale() {
  const locale = useLocale() as Language
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function choose(next: Language) {
    if (next === locale) return
    saveLocaleCookie(next)
    startTransition(() => router.refresh())
  }

  return { locale, choose, pending }
}

/** EN / FR toggle for seller pages. Saves the NEXT_LOCALE cookie (1 year). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Common")
  const { locale, choose, pending } = useChangeLocale()

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn("inline-flex rounded-lg border bg-card p-0.5", pending && "opacity-60", className)}
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-pressed={lang === locale}
          onClick={() => choose(lang)}
          className={cn(
            "min-h-10 min-w-10 rounded-md px-2 text-xs font-semibold uppercase md:min-h-8 md:min-w-8",
            lang === locale ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}
