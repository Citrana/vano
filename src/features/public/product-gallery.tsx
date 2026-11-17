"use client"

import { ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { cn } from "cn"

/** Swipeable photo gallery (CSS scroll-snap) with thumbnails and arrows. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const t = useTranslations("Public")
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  function go(next: number) {
    const el = track.current
    if (!el) return
    const clamped = Math.max(0, Math.min(images.length - 1, next))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" })
  }

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <ImageIcon className="size-10" aria-hidden />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
          }}
          className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto rounded-xl bg-muted"
          aria-roledescription="carousel"
        >
          {images.map((src, i) => (
            <div
              key={src}
              className="h-full w-full shrink-0 snap-center"
              role="group"
              aria-roledescription="slide"
              aria-label={t("photo", { index: i + 1, total: images.length })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage URL */}
              <img
                src={src}
                alt={i === 0 ? name : ""}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="size-full object-cover"
              />
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label={t("previous")}
              className="absolute top-1/2 left-2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow disabled:opacity-0 md:inline-flex"
            >
              <ChevronLeftIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === images.length - 1}
              aria-label={t("next")}
              className="absolute top-1/2 right-2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow disabled:opacity-0 md:inline-flex"
            >
              <ChevronRightIcon className="size-5" />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
              {images.map((src, i) => (
                <span key={src} className={cn("size-1.5 rounded-full bg-white/60", i === index && "bg-white")} />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="hidden gap-2 md:flex">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => go(i)}
              aria-label={t("photo", { index: i + 1, total: images.length })}
              aria-current={i === index}
              className={cn("size-16 overflow-hidden rounded-lg border-2", i === index ? "border-primary" : "border-transparent opacity-70")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage URL */}
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
