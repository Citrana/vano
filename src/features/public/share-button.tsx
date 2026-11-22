"use client"

import { Share2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { CSSProperties } from "react"
import { cn } from "cn"
import { useShare } from "./use-share"

/** A square icon button (44px on phones); the caller sets its size and corners. */
const SQUARE = "flex shrink-0 items-center justify-center border bg-card text-foreground [&_svg]:size-4"

/**
 * Shares a product's link (the phone's share sheet, else "Link copied"),
 * beside an Order button: on the product cards and the product page.
 * `url` is read on tap (`window` doesn't exist during server rendering).
 * `preview`: an inert picture of the button (look editor).
 */
export function ShareButton({
  name,
  url,
  preview = false,
  className,
  style,
}: {
  name: string
  url: () => string
  preview?: boolean
  className?: string
  style?: CSSProperties
}) {
  const t = useTranslations("Public")
  const share = useShare()
  if (preview) {
    return (
      <span aria-hidden style={style} className={cn(SQUARE, className)}>
        <Share2Icon />
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-label={t("shareProduct", { product: name })}
      title={t("shareProduct", { product: name })}
      onClick={() => void share({ title: name, url: url() })}
      style={style}
      className={cn(SQUARE, "transition-colors hover:bg-muted focus-ring", className)}
    >
      <Share2Icon />
    </button>
  )
}
