"use client"

import { BanIcon, LockIcon, MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import {
  BUTTON_DECORATIONS,
  BUTTON_DESIGNS,
  ORDER_LABELS,
  type ButtonDecoration,
  type ButtonDesign,
} from "../../../../convex/lib/looks/buttonDesigns"
import { PRESETS } from "../../../../convex/lib/looks/presets"
import { resolveButtons } from "../../../../convex/lib/looks/resolve"
import type { ButtonsFacet } from "../../../../convex/lib/looks/validators"
import { STICKER_FILES } from "@/assets/images/stickers/files"
import { buttonVariants } from "@/components/ui/button"
import { ShopLookScope } from "../look-scope"
import { ChoiceGroup, radioKeyDown } from "./choice-group"
import { ProNote } from "./pro-note"
import type { LookEditorState } from "./use-look-editor"
import { useUpgradePlanName } from "@/features/billing/use-plan-catalog"

/** Decoration icon → the sticker file it reuses. */
const DECORATION_FILE: Record<Exclude<ButtonDecoration, "none">, keyof typeof STICKER_FILES> = {
  flower: "flower",
  heart: "heart",
  star: "star",
  bow: "bow",
  sparkle: "sparkles",
}

function DecorationIcon({ decoration }: { decoration: ButtonDecoration }) {
  if (decoration === "none") return <BanIcon className="size-5" aria-hidden />
  const mask = `url("${STICKER_FILES[DECORATION_FILE[decoration]].src}") center / contain no-repeat`
  return <span aria-hidden className="size-5 bg-current" style={{ mask, WebkitMask: mask }} />
}

/**
 * Buttons: a gallery of decorative designs, the decoration icon and the
 * order button's wording, then shape, fill and weight, with a live
 * sample. Everything is the `buttons` facet of the draft, so draft,
 * publish, "Reset to preset" and the unsaved dot work as for any edit.
 */
export function ButtonsSection({
  editor,
  entitled,
  disabled,
}: {
  editor: LookEditorState
  /** The plan includes custom looks; else only Classic can be published. */
  entitled: boolean
  disabled: boolean
}) {
  const t = useTranslations("LookEditor.buttons")
  const tl = useTranslations("LookEditor.lock")
  const availableOn = tl("availableOn", { plan: useUpgradePlanName("allLooks") })
  const tp = useTranslations("Public")
  const resolved = editor.resolved.buttons
  // Edit the stored facet (not the resolved one), so defaults stay defaults.
  const facet: ButtonsFacet = editor.draft.overrides.buttons ?? PRESETS[editor.draft.preset].buttons
  const set = (patch: Partial<ButtonsFacet>) => editor.setOverride("buttons", { ...facet, ...patch })
  const pickDesign = (design: ButtonDesign) => set({ design, decoration: undefined })
  const decorationIndex = BUTTON_DECORATIONS.indexOf(resolved.decoration)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id="button-design-label">
          {t("design")}
        </span>
        <div role="radiogroup" aria-labelledby="button-design-label" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BUTTON_DESIGNS.map((design, i) => {
            const selected = design === resolved.design
            const locked = !entitled && design !== "classic"
            const tileLook = { ...editor.resolved, buttons: resolveButtons({ ...facet, design, decoration: undefined }) }
            return (
              <button
                key={design}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={locked ? `${t(`designs.${design}`)}, ${availableOn}` : t(`designs.${design}`)}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => pickDesign(design)}
                onKeyDown={(e) => radioKeyDown(e, i, BUTTON_DESIGNS.length, (n) => pickDesign(BUTTON_DESIGNS[n]))}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border bg-card p-1.5 text-left focus-ring disabled:opacity-60",
                  selected && "tile-selected",
                )}
              >
                <ShopLookScope
                  look={tileLook}
                  className="pointer-events-none flex flex-col items-center justify-center gap-2.5 rounded-md px-2 pt-4 pb-3"
                >
                  <span aria-hidden className="shop-btn shop-action inline-flex h-8 items-center bg-primary px-3 text-xs text-primary-foreground">
                    {t("tileSample")}
                  </span>
                  <span aria-hidden className="shop-chip chip-selected inline-flex h-6 items-center border px-3 text-[0.6875rem]">
                    M
                  </span>
                </ShopLookScope>
                <span className="flex items-center gap-1 px-1 pb-0.5 text-sm font-medium">
                  {t(`designs.${design}`)}
                  {locked ? <LockIcon className="size-3.5 opacity-70" aria-hidden /> : null}
                </span>
              </button>
            )
          })}
        </div>
        {!entitled ? <ProNote /> : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id="button-decoration-label">
          {t("decoration")}
        </span>
        <div role="radiogroup" aria-labelledby="button-decoration-label" className="flex flex-wrap gap-2">
          {BUTTON_DECORATIONS.map((decoration, i) => {
            const selected = decoration === resolved.decoration
            return (
              <button
                key={decoration}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={t(`decorations.${decoration}`)}
                title={t(`decorations.${decoration}`)}
                tabIndex={selected || (decorationIndex < 0 && i === 0) ? 0 : -1}
                disabled={disabled}
                onClick={() => set({ decoration })}
                onKeyDown={(e) => radioKeyDown(e, i, BUTTON_DECORATIONS.length, (n) => set({ decoration: BUTTON_DECORATIONS[n] }))}
                className={cn(
                  "flex size-11 items-center justify-center rounded-lg border focus-ring",
                  selected ? "chip-selected" : "bg-card hover:bg-muted",
                )}
              >
                <DecorationIcon decoration={decoration} />
              </button>
            )
          })}
        </div>
      </div>

      <ChoiceGroup
        label={t("label")}
        wrap
        value={resolved.label}
        disabled={disabled}
        onChange={(label) => set({ label })}
        options={ORDER_LABELS.map((label) => ({ value: label, label: tp(`orderLabels.${label}`) }))}
      />

      <ChoiceGroup
        label={t("shape")}
        value={resolved.shape}
        disabled={disabled}
        onChange={(shape) => set({ shape })}
        options={[
          { value: "rounded", label: t("rounded") },
          { value: "pill", label: t("pill") },
          { value: "square", label: t("square") },
        ]}
      />
      <ChoiceGroup
        label={t("fill")}
        value={resolved.fill}
        disabled={disabled}
        onChange={(fill) => set({ fill })}
        options={[
          { value: "solid", label: t("solid") },
          { value: "outline", label: t("outline") },
        ]}
      />
      <ChoiceGroup
        label={t("weight")}
        value={resolved.weight}
        disabled={disabled}
        onChange={(weight) => set({ weight })}
        options={[
          { value: "soft", label: t("soft") },
          { value: "bold", label: t("bold") },
        ]}
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("sample")}</span>
        <ShopLookScope look={editor.resolved} className="flex flex-col gap-4 rounded-xl border p-4 pt-5">
          <div aria-hidden className="flex flex-wrap gap-2">
            <span className="shop-chip chip-selected inline-flex min-h-10 items-center rounded-full border px-4 text-sm">{tp("all")}</span>
            <span className="shop-chip inline-flex min-h-10 items-center rounded-full border bg-card px-4 text-sm">M</span>
            <span className="shop-chip inline-flex min-h-10 items-center rounded-full border bg-card px-4 text-sm">L</span>
            <span className="shop-btn inline-flex items-center rounded-full bg-(--chip) px-2.5 py-1 text-xs font-semibold text-(--chip-foreground)">
              {tp("soldOut")}
            </span>
          </div>
          <span aria-hidden className={buttonVariants({ size: "lg", variant: "whatsapp", className: "shop-btn shop-action w-full" })}>
            <MessageCircleIcon />
            {tp(`orderLabels.${resolved.label}`)}
          </span>
          <p className="text-xs text-muted-foreground">{t("whatsappNote")}</p>
        </ShopLookScope>
      </div>
    </div>
  )
}
