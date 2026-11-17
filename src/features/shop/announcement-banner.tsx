"use client"

import { useQuery } from "convex/react"
import { MegaphoneIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { api } from "../../../convex/_generated/api"

/** The platform announcement (admin settings), in the seller's UI language. */
export function AnnouncementBanner() {
  const t = useTranslations("Announcement")
  const locale = useLocale()
  const viewer = useQuery(api.users.viewer, {})
  const announcement = viewer?.announcement
  if (!announcement) return null
  const text = locale === "fr" ? announcement.fr : announcement.en
  return (
    <div role="status" className="border-b bg-secondary">
      <p className="mx-auto flex max-w-5xl items-start gap-2 px-4 py-3 text-sm">
        <MegaphoneIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="sr-only">{t("label")}: </span>
        <span className="whitespace-pre-line">{text}</span>
      </p>
    </div>
  )
}
