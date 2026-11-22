"use client"

import { ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { cn } from "cn"
import { ProductLightbox } from "./product-lightbox"

/** Photo tiles: the soft tint of the look, square corners (CLAUDE.md "Public pages"). */
const TILE = "relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[2px] bg-muted"
/** The whole photo, never cropped or zoomed. */
const PHOTO = "max-h-full max-w-full object-contain"
const ARROW =
  "focus-ring absolute top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black shadow-float disabled:pointer-events-none disabled:opacity-0"

/**
 * The product page photos, on every screen size: one main photo
 * (swipeable, CSS scroll-snap) with previous / next arrows, and small
 * thumbnails below it. Every photo shows whole on a tinted tile; tapping
 * the main photo opens it full size (`ProductLightbox`).
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const t = useTranslations("Public")
  const track = useRef<HTMLDivElement>(null)
  const thumbs = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)

  function go(next: number) {
    const el = track.current
    if (!el) return
    const clamped = Math.max(0, Math.min(images.length - 1, next))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" })
  }

  // Keep the selected thumbnail visible (horizontal scroll only, never the page).
  useEffect(() => {
    const row = thumbs.current
    const thumb = row?.children[index] as HTMLElement | undefined
    if (!row || !thumb) return
    const left = thumb.offsetLeft - row.offsetLeft
    if (left < row.scrollLeft) row.scrollTo({ left, behavior: "smooth" })
    else if (left + thumb.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: left + thumb.offsetWidth - row.clientWidth, behavior: "smooth" })
    }
  }, [index])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      go(index - 1)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      go(index + 1)
    }
  }

  if (images.length === 0) {
    return (
      <div className={cn(TILE, "text-muted-foreground")}>
        <ImageIcon className="size-10" aria-hidden />
      </div>
    )
  }

  const several = images.length > 1

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="relative">
        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
          }}
          onKeyDown={several ? onKeyDown : undefined}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          aria-roledescription="carousel"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setLightbox(i)}
              aria-label={t("openPhoto", { index: i + 1, total: images.length })}
              // 4:5, but never taller than ~2/3 of the screen (34rem at most), so the thumbnails stay in view.
              className={cn(TILE, "max-h-[min(65vh,34rem)] w-full shrink-0 cursor-zoom-in snap-center focus-ring")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage URL */}
              <img
                src={src}
                alt={i === 0 ? name : ""}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className={PHOTO}
              />
            </button>
          ))}
        </div>
        {several ? (
          <>
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t("previous")} className={cn(ARROW, "left-2")}>
              <ChevronLeftIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === images.length - 1}
              aria-label={t("next")}
              className={cn(ARROW, "right-2")}
            >
              <ChevronRightIcon className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {several ? (
        <div ref={thumbs} className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => go(i)}
              aria-label={t("photo", { index: i + 1, total: images.length })}
              aria-current={i === index}
              className={cn(
                TILE,
                "w-16 shrink-0 border-2 transition-opacity focus-ring md:w-20",
                i === index ? "border-foreground" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage URL */}
              <img src={src} alt="" loading="lazy" decoding="async" className={PHOTO} />
            </button>
          ))}
        </div>
      ) : null}

      <ProductLightbox images={images} name={name} index={lightbox} onIndexChange={setLightbox} />
    </div>
  )
}
