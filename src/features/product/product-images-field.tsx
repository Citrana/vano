"use client"

import { AlertCircleIcon, ImagePlusIcon, Loader2Icon, StarIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef } from "react"
import { cn } from "cn"
import { LIMITS } from "../../../convex/lib/catalog"
import type { ImageItem } from "./use-product-images"

/** Photo grid: first = cover, tap ★ to make another one the cover. */
export function ProductImagesField({
  items,
  onAdd,
  onRemove,
  onMakeCover,
  error,
}: {
  items: ImageItem[]
  onAdd: (files: File[]) => void
  onRemove: (key: string) => void
  onMakeCover: (key: string) => void
  error?: string
}) {
  const t = useTranslations("ProductForm")
  const input = useRef<HTMLInputElement>(null)
  const canAdd = items.length < LIMITS.maxImages

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {t("images")}
        <span className="ml-0.5 text-destructive" aria-hidden>
          *
        </span>
      </span>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {items.map((item, index) => (
          <li key={item.key} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob / Convex storage URL */}
            <img src={item.url} alt="" className={cn("size-full object-cover", item.status !== "done" && "opacity-50")} />
            {item.status === "compressing" || item.status === "uploading" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-medium">
                <Loader2Icon className="size-5 animate-spin" aria-hidden />
                {item.status === "compressing" ? t("compressing") : t("uploading")}
              </div>
            ) : null}
            {item.status === "error" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/20 p-1 text-center text-xs font-medium text-destructive">
                <AlertCircleIcon className="size-5" aria-hidden />
                {t(item.error ?? "uploadFailed")}
              </div>
            ) : null}
            {index === 0 && item.status === "done" ? (
              <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {t("cover")}
              </span>
            ) : null}
            {index > 0 && item.status === "done" ? (
              <button
                type="button"
                onClick={() => onMakeCover(item.key)}
                aria-label={t("makeCover")}
                className="absolute bottom-1 left-1 inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <StarIcon className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onRemove(item.key)}
              aria-label={t("removeImage")}
              className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <XIcon className="size-4" />
            </button>
          </li>
        ))}
        {canAdd ? (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={cn(
                "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs font-medium text-muted-foreground hover:bg-muted",
                error && "border-destructive/60"
              )}
            >
              <ImagePlusIcon className="size-6" aria-hidden />
              {t("addImages")}
            </button>
          </li>
        ) : null}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("imagesHelp", { max: LIMITS.maxImages })}</p>
      )}
    </div>
  )
}
