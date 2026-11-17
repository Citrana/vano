"use client"

import { ImagePlusIcon, Loader2Icon, StoreIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { toast } from "sonner"
import type { Id } from "../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { useImageUpload } from "@/lib/use-image-upload"

/** Optional shop logo: pick → compress → upload; reports the storage id. */
export function LogoField({
  previewUrl,
  onChange,
  onBusyChange,
}: {
  previewUrl: string | null
  onChange: (value: { storageId: Id<"_storage">; url: string } | null) => void
  onBusyChange: (busy: boolean) => void
}) {
  const t = useTranslations("ShopForm")
  const tp = useTranslations("ProductForm")
  const upload = useImageUpload()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    onBusyChange(true)
    try {
      const storageId = await upload(file)
      onChange({ storageId, url: URL.createObjectURL(file) })
    } catch (error) {
      toast.error(error instanceof Error && error.message === "NOT_AN_IMAGE" ? tp("notAnImage") : tp("uploadFailed"))
    } finally {
      setBusy(false)
      onBusyChange(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
        {busy ? (
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-label={t("logoUploading")} />
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage / blob URL
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <StoreIcon className="size-7 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          id="logo"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          <ImagePlusIcon />
          {previewUrl ? t("logoChange") : t("logoAdd")}
        </Button>
        {previewUrl && !busy ? (
          <Button type="button" variant="ghost" onClick={() => onChange(null)}>
            {t("logoRemove")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
