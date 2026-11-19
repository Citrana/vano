"use client"

import { DownloadIcon, Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import type { ResolvedEventBanner } from "../../../../convex/lib/looks/resolve"
import { Button } from "@/components/ui/button"
import { EventBanner } from "./event-banner"

/**
 * Ready sizes for sharing. Drawn at CSS size, captured at 3×:
 * 1080×1920 (status / story), 1080×1080 (post), 1200×630 (wide / link).
 */
const SIZES = {
  story: { width: 360, height: 640 },
  square: { width: 360, height: 360 },
  wide: { width: 400, height: 210 },
} as const
type Size = keyof typeof SIZES
const SCALE = 3

async function deliver(blob: Blob, name: string) {
  const file = new File([blob], name, { type: "image/png" })
  // Phones: straight to the share sheet (WhatsApp, Instagram…). Computers: a download.
  const touch = window.matchMedia("(pointer: coarse)").matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * "Share it on WhatsApp or Instagram": the banner as a PNG, drawn by the
 * same `EventBanner` the shop shows, so the image always matches. Made in
 * the browser from the seller's own design (nothing is uploaded); the plan
 * check is the `locked` prop (`canShopDo` / `promoEntitled`). Publishing
 * and scheduling, the parts that change the public shop, are checked on
 * the server.
 */
export function BannerDownloads({
  banner,
  slug,
  locked,
}: {
  banner: ResolvedEventBanner
  slug: string
  locked: boolean
}) {
  const t = useTranslations("EventBanners.download")
  const [making, setMaking] = useState<Size | null>(null)
  const node = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!making) return
    let cancelled = false
    void (async () => {
      try {
        await document.fonts.ready
        const target = node.current
        if (!target || cancelled) return
        const { domToBlob } = await import("modern-screenshot")
        const blob = await domToBlob(target, { scale: SCALE, type: "image/png" })
        if (!cancelled) await deliver(blob, `${slug}-${banner.template}-${making}.png`)
      } catch {
        if (!cancelled) toast.error(t("failed"))
      } finally {
        if (!cancelled) setMaking(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [making, banner.template, slug, t])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-medium">{t("title")}</h4>
        <p className="text-xs text-muted-foreground">{locked ? t("locked") : t("help")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(SIZES) as Size[]).map((size) => (
          <Button
            key={size}
            type="button"
            variant="outline"
            disabled={locked || making !== null}
            onClick={() => setMaking(size)}
            aria-busy={making === size}
          >
            {making === size ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
            {making === size ? t("making") : t(size)}
          </Button>
        ))}
      </div>
      {making
        ? createPortal(
            // Off screen, at the export's CSS size; only the inner node is captured.
            <div aria-hidden style={{ position: "fixed", left: -10_000, top: 0, pointerEvents: "none" }}>
              <div ref={node} style={{ width: SIZES[making].width, height: SIZES[making].height }}>
                <EventBanner banner={banner} format={making} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
