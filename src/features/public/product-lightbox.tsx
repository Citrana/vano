"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { KeyboardEvent } from "react"

const CONTROL =
  "focus-ring absolute inline-flex size-11 items-center justify-center rounded-full bg-white/90 text-black shadow-float disabled:pointer-events-none disabled:opacity-0 [&_svg]:size-5"

/**
 * A product's photos full size (CLAUDE.md "Public pages"): the whole
 * photo on a dark backdrop, never cropped, with previous / next buttons,
 * the arrow keys and Escape. `index` null = closed. Rendered in a portal
 * (outside the shop look), so it uses neutral black and white.
 */
export function ProductLightbox({
  images,
  name,
  index,
  onIndexChange,
}: {
  images: string[]
  name: string
  index: number | null
  onIndexChange: (index: number | null) => void
}) {
  const t = useTranslations("Public")
  const tc = useTranslations("Common")
  const open = index !== null
  const current = index ?? 0
  const total = images.length
  const go = (next: number) => onIndexChange(Math.max(0, Math.min(total - 1, next)))

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") go(current - 1)
    else if (e.key === "ArrowRight") go(current + 1)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/90 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          onKeyDown={onKeyDown}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none md:p-12"
        >
          <DialogPrimitive.Title className="sr-only">{name}</DialogPrimitive.Title>
          {open ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
            <img
              src={images[current]}
              alt={t("photo", { index: current + 1, total })}
              className="max-h-full max-w-full object-contain"
            />
          ) : null}
          <DialogPrimitive.Close aria-label={tc("close")} className={`${CONTROL} top-3 right-3`}>
            <XIcon />
          </DialogPrimitive.Close>
          {total > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(current - 1)}
                disabled={current === 0}
                aria-label={t("previous")}
                className={`${CONTROL} top-1/2 left-3 -translate-y-1/2`}
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                onClick={() => go(current + 1)}
                disabled={current === total - 1}
                aria-label={t("next")}
                className={`${CONTROL} top-1/2 right-3 -translate-y-1/2`}
              >
                <ChevronRightIcon />
              </button>
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm font-medium text-white tabular-nums" aria-live="polite">
                {current + 1} / {total}
              </p>
            </>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
