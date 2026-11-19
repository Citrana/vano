"use client"

import { ImagePlusIcon, Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { useId, useRef, useState, type PointerEvent } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import type { Id } from "../../../../convex/_generated/dataModel"
import {
  ARTWORK_IDS,
  BANNER_TEXT_MAX,
  GRADIENT_IDS,
  gradientCss,
  ZOOM_MAX,
  ZOOM_MIN,
  type BannerAlign,
  type BannerHeight,
} from "../../../../convex/lib/looks/banners"
import { PRESETS } from "../../../../convex/lib/looks/presets"
import type { BannerFacet, BannerText } from "../../../../convex/lib/looks/validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useImageUpload } from "@/lib/use-image-upload"
import { ARTWORK_IMAGES } from "../artworks"
import { ShopLookScope } from "../look-scope"
import { ShopBanner } from "../shop-banner"
import { ChoiceGroup, radioKeyDown } from "./choice-group"
import type { LookEditorState } from "./use-look-editor"

type Kind = BannerFacet["kind"]
type PhotoBanner = Extract<BannerFacet, { kind: "photo" }>

/** Banner photos are compressed a little wider than product photos. */
const BANNER_MAX_DIMENSION = 1600
/** Bigger originals are refused before compressing (it would freeze older phones). */
const MAX_SOURCE_MB = 25

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** Drag (or use the sliders) to choose what stays in view; zoom in up to 2x. */
function FocalPoint({
  editor,
  banner,
  disabled,
}: {
  editor: LookEditorState
  banner: PhotoBanner
  disabled: boolean
}) {
  const t = useTranslations("LookEditor.banner")
  const id = useId()
  const frame = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const set = (patch: Partial<PhotoBanner>) => editor.setOverride("banner", { ...banner, ...patch })
  const resolvedBanner = editor.resolved.banner

  function moveTo(event: PointerEvent<HTMLDivElement>) {
    const rect = frame.current?.getBoundingClientRect()
    if (!rect) return
    set({
      focusX: Math.round(clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)),
      focusY: Math.round(clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("cropHelp")}</p>
      <div
        ref={frame}
        aria-hidden
        className={cn("relative touch-none overflow-hidden rounded-lg border select-none", disabled ? "" : "cursor-crosshair")}
        onPointerDown={(e) => {
          if (disabled) return
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          moveTo(e)
        }}
        onPointerMove={(e) => dragging.current && moveTo(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <ShopLookScope look={editor.resolved}>
          {resolvedBanner.kind === "photo" ? (
            <ShopBanner banner={{ ...resolvedBanner, text: null }} sizing="phone" priority={false} />
          ) : (
            <div className="flex h-40 items-center justify-center bg-muted">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </ShopLookScope>
        <span
          className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
          style={{ left: `${banner.focusX}%`, top: `${banner.focusY}%` }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["focusX", t("focusX"), 0, 100, 1],
            ["focusY", t("focusY"), 0, 100, 1],
            ["zoom", t("zoom"), ZOOM_MIN, ZOOM_MAX, 0.05],
          ] as const
        ).map(([key, label, min, max, step]) => (
          <div key={key} className="flex flex-col gap-1">
            <label htmlFor={`${id}-${key}`} className="text-sm font-medium">
              {label}
            </label>
            <input
              id={`${id}-${key}`}
              type="range"
              min={min}
              max={max}
              step={step}
              value={banner[key]}
              disabled={disabled}
              onChange={(e) => set({ [key]: Number(e.target.value) })}
              className="h-11 w-full accent-[var(--foreground)] focus-ring"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Banner: none, own photo (focal point + zoom), curated gradient or ready-made artwork; size and short text. */
export function BannerSection({ editor, disabled }: { editor: LookEditorState; disabled: boolean }) {
  const t = useTranslations("LookEditor.banner")
  const upload = useImageUpload({ maxDimension: BANNER_MAX_DIMENSION })
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const textId = useId()

  const banner = editor.draft.overrides.banner ?? PRESETS[editor.draft.preset].banner
  // "Photo" picked but nothing uploaded yet: show the upload button, keep the banner.
  const [photoPending, setPhotoPending] = useState(false)
  const view: Kind = photoPending && banner.kind !== "photo" ? "photo" : banner.kind
  const height: BannerHeight = banner.kind === "none" ? "md" : banner.height
  const text: BannerText | undefined = banner.kind === "none" ? undefined : banner.text

  function setBanner(next: BannerFacet) {
    editor.setOverride("banner", next)
  }

  function pickKind(kind: Kind) {
    setPhotoPending(kind === "photo")
    if (kind === "none") setBanner({ kind: "none" })
    if (kind === "gradient" && banner.kind !== "gradient") setBanner({ kind: "gradient", gradientId: GRADIENT_IDS[0], height, text })
    if (kind === "artwork" && banner.kind !== "artwork") setBanner({ kind: "artwork", artworkId: ARTWORK_IDS[0], height, text })
    // "photo": nothing changes until a photo is uploaded.
  }

  async function pick(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_SOURCE_MB * 1024 * 1024) {
      toast.error(t("tooBig", { mb: MAX_SOURCE_MB }))
      if (input.current) input.current.value = ""
      return
    }
    setBusy(true)
    try {
      const imageId: Id<"_storage"> = await upload(file)
      editor.addLocalUrl(imageId, URL.createObjectURL(file))
      setBanner({ kind: "photo", imageId, focusX: 50, focusY: 50, zoom: 1, height, text })
    } catch (error) {
      toast.error(error instanceof Error && error.message === "NOT_AN_IMAGE" ? t("notAnImage") : t("uploadFailed"))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  function setText(patch: Partial<BannerText>) {
    if (banner.kind === "none") return
    const next = { value: text?.value ?? "", align: text?.align ?? ("start" as BannerAlign), ...patch }
    setBanner({ ...banner, text: next.value.length > 0 ? next : undefined })
  }

  const uploadButton = (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => input.current?.click()} className="w-fit">
        {busy ? <Loader2Icon className="animate-spin" /> : <ImagePlusIcon />}
        {busy ? t("uploading") : banner.kind === "photo" ? t("changePhoto") : t("uploadPhoto")}
      </Button>
    </>
  )

  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup
        label={t("type")}
        value={view}
        disabled={disabled}
        onChange={pickKind}
        options={[
          { value: "none", label: t("none") },
          { value: "photo", label: t("photo") },
          { value: "gradient", label: t("gradient") },
          { value: "artwork", label: t("artwork") },
        ]}
      />

      {view === "photo" ? (
        <div className="flex flex-col gap-3">
          {uploadButton}
          <p className="text-xs text-muted-foreground">{t("photoHelp")}</p>
          {banner.kind === "photo" ? <FocalPoint editor={editor} banner={banner} disabled={disabled} /> : null}
        </div>
      ) : null}

      {view === "gradient" && banner.kind === "gradient" ? (
        <div role="radiogroup" aria-label={t("gradient")} className="grid grid-cols-4 gap-2">
          {GRADIENT_IDS.map((gradientId, i) => {
            const selected = banner.gradientId === gradientId
            return (
              <button
                key={gradientId}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={t(`gradients.${gradientId}`)}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => setBanner({ ...banner, gradientId })}
                onKeyDown={(e) => radioKeyDown(e, i, GRADIENT_IDS.length, (n) => setBanner({ ...banner, gradientId: GRADIENT_IDS[n] }))}
                className={cn(
                  "h-12 rounded-lg border focus-ring",
                  selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ backgroundImage: gradientCss(gradientId) }}
              />
            )
          })}
        </div>
      ) : null}

      {view === "artwork" && banner.kind === "artwork" ? (
        <div role="radiogroup" aria-label={t("artwork")} className="grid grid-cols-3 gap-2">
          {ARTWORK_IDS.map((artworkId, i) => {
            const selected = banner.artworkId === artworkId
            return (
              <button
                key={artworkId}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={t(`artworks.${artworkId}`)}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => setBanner({ ...banner, artworkId })}
                onKeyDown={(e) => radioKeyDown(e, i, ARTWORK_IDS.length, (n) => setBanner({ ...banner, artworkId: ARTWORK_IDS[n] }))}
                className={cn(
                  "relative h-14 overflow-hidden rounded-lg border focus-ring",
                  selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
              >
                <Image src={ARTWORK_IMAGES[artworkId]} alt="" fill sizes="120px" className="object-cover" />
              </button>
            )
          })}
        </div>
      ) : null}

      {banner.kind !== "none" ? (
        <>
          <ChoiceGroup
            label={t("height")}
            value={height}
            disabled={disabled}
            onChange={(h) => setBanner({ ...banner, height: h })}
            options={[
              { value: "sm", label: t("small") },
              { value: "md", label: t("medium") },
              { value: "lg", label: t("large") },
            ]}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor={textId} className="text-sm font-medium">
              {t("text")}
            </label>
            <Input
              id={textId}
              value={text?.value ?? ""}
              maxLength={BANNER_TEXT_MAX}
              disabled={disabled}
              placeholder={t("textPlaceholder")}
              aria-describedby={`${textId}-count`}
              onChange={(e) => setText({ value: e.target.value.replace(/[\r\n]+/g, " ") })}
            />
            <p id={`${textId}-count`} className="text-xs text-muted-foreground">
              {t("textHelp", { count: (text?.value ?? "").length, max: BANNER_TEXT_MAX })}
            </p>
          </div>
          {text ? (
            <ChoiceGroup
              label={t("align")}
              value={text.align}
              disabled={disabled}
              onChange={(align) => setText({ align })}
              options={[
                { value: "start", label: t("alignStart") },
                { value: "center", label: t("alignCenter") },
              ]}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
