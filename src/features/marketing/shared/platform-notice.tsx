"use client"

import { useQuery } from "convex/react"
import { MegaphoneIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { api } from "../../../../convex/_generated/api"

/** The admin announcement (e.g. maintenance) above the landing nav. */
export function PlatformNotice() {
  const t = useTranslations("Announcement")
  const locale = useLocale()
  const notice = useQuery(api.public.platformNotice, {})
  if (!notice) return null
  return (
    <div role="status" className="bg-plum text-white">
      <p className="mx-auto flex max-w-6xl items-start justify-center gap-2 px-4 py-2.5 text-sm">
        <MegaphoneIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="sr-only">{t("label")}: </span>
        <span className="whitespace-pre-line">{locale === "fr" ? notice.fr : notice.en}</span>
      </p>
    </div>
  )
}
