"use client"

import { useQuery } from "convex/react"
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { api } from "../../../convex/_generated/api"
import { slugProblem } from "../../../convex/lib/slug"
import { useDebounced } from "@/lib/use-debounced"

/**
 * Live availability under the slug input. Format problems are shown by the
 * form's own validation; this only reports "checking / available / taken".
 */
export function SlugStatus({ slug }: { slug: string }) {
  const t = useTranslations("ShopForm")
  const tv = useTranslations("Validation")
  const debounced = useDebounced(slug)
  const checkable = slugProblem(debounced) === null
  const result = useQuery(api.shops.checkSlug, checkable ? { slug: debounced } : "skip")

  if (!checkable || slugProblem(slug) !== null) return null
  if (debounced !== slug || result === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
        <Loader2Icon className="size-3 animate-spin" aria-hidden /> {t("slugChecking")}
      </span>
    )
  }
  return result.ok ? (
    <span className="inline-flex items-center gap-1 text-xs text-success" aria-live="polite">
      <CheckIcon className="size-3" aria-hidden /> {t("slugAvailable")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-destructive" aria-live="polite">
      <XIcon className="size-3" aria-hidden /> {tv("slugTaken")}
    </span>
  )
}
