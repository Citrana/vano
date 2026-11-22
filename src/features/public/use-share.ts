"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { toast } from "sonner"

/**
 * Shares a link: the phone's share sheet, else copies it ("Link copied").
 * Closing the share sheet says nothing; any other failure shows a short
 * message (toasts are instant feedback on the visitor's own action).
 */
export function useShare() {
  const t = useTranslations("Public")
  return useCallback(
    async ({ title, url }: { title: string; url: string }) => {
      try {
        if (typeof navigator.share === "function") {
          await navigator.share({ title, url })
          return
        }
        await navigator.clipboard.writeText(url)
        toast.success(t("linkCopied"))
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        toast.error(t("shareFailed"))
      }
    },
    [t],
  )
}
