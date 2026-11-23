"use client"

import { CheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { cn } from "cn"
import { bestOn, normalizeHex, type Hex } from "../../../../convex/lib/looks/color"
import { ACCENT_SWATCHES, BACKGROUND_SWATCHES } from "../../../../convex/lib/looks/presets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { radioKeyDown } from "./choice-group"
import { ContrastNotes } from "./contrast-notes"
import type { LookEditorState } from "./use-look-editor"

/** Swatches (radiogroup) + a custom colour (native picker and hex field). Also used by the Promo bar. */
export function ColorPicker({
  label,
  swatches,
  value,
  onChange,
  disabled,
}: {
  label: string
  swatches: readonly Hex[]
  value: Hex
  onChange: (color: Hex) => void
  disabled: boolean
}) {
  const t = useTranslations("LookEditor.colors")
  const id = useId()
  const [hex, setHex] = useState<string>(value)
  const [lastValue, setLastValue] = useState<Hex>(value)
  if (value !== lastValue) {
    // Keep the text field in step with picks made elsewhere (swatch, fix).
    setLastValue(value)
    setHex(value)
  }
  const index = swatches.indexOf(value)
  const isCustom = index < 0
  const hexInvalid = normalizeHex(hex) === null

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="-ml-1.5 flex flex-wrap gap-0.5">
        {swatches.map((color, i) => {
          const selected = color === value
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t("swatch", { color })}
              tabIndex={selected || (isCustom && i === 0) ? 0 : -1}
              onClick={() => onChange(color)}
              onKeyDown={(e) => radioKeyDown(e, i, swatches.length, (n) => onChange(swatches[n]))}
              className="group flex size-11 items-center justify-center rounded-full focus-ring"
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-transform",
                  selected ? "tile-selected" : "ring-1 ring-foreground/15 group-hover:scale-105",
                )}
                style={{ backgroundColor: color }}
              >
                {selected ? <CheckIcon className="size-4" style={{ color: bestOn(color, ["#ffffff", "#1a1412"]) }} aria-hidden /> : null}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium" htmlFor={`${id}-picker`}>
          <input
            id={`${id}-picker`}
            type="color"
            value={value}
            onChange={(e) => {
              const next = normalizeHex(e.target.value)
              if (next) onChange(next)
            }}
            className="size-11 cursor-pointer rounded-md border bg-card p-1 focus-ring"
          />
          {t("custom")}
        </label>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-hex`} className="sr-only">
            {t("hexLabel", { field: label })}
          </label>
          <Input
            id={`${id}-hex`}
            value={hex}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            aria-invalid={hexInvalid || undefined}
            onChange={(e) => {
              setHex(e.target.value)
              // Apply once a full #rrggbb is typed; a partial value just waits.
              const next = /^#?[0-9a-f]{6}$/i.test(e.target.value.trim()) ? normalizeHex(e.target.value) : null
              if (next) onChange(next)
            }}
            onBlur={() => setHex(value)}
            className="w-28 font-mono uppercase"
          />
        </div>
        {isCustom ? <span className="pb-3 text-xs text-muted-foreground">{t("customInUse")}</span> : null}
      </div>
    </fieldset>
  )
}

/** Accent and background: curated swatches first, then a custom colour. */
export function ColorsSection({ editor, disabled }: { editor: LookEditorState; disabled: boolean }) {
  const t = useTranslations("LookEditor.colors")
  const { colors } = editor.resolved
  const custom = editor.draft.overrides.colors
  const accent = (custom?.accent ?? colors.primary) as Hex
  const background = (custom?.background ?? colors.background) as Hex

  const set = (next: { accent?: Hex; background?: Hex }) =>
    editor.setOverride("colors", { accent: next.accent ?? accent, background: next.background ?? background })

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <ColorPicker label={t("accent")} swatches={ACCENT_SWATCHES} value={accent} onChange={(c) => set({ accent: c })} disabled={disabled} />
      <ColorPicker
        label={t("background")}
        swatches={BACKGROUND_SWATCHES}
        value={background}
        onChange={(c) => set({ background: c })}
        disabled={disabled}
      />
      <ContrastNotes problems={editor.problems} onFix={editor.applyFix} disabled={disabled} />
      {custom ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          disabled={disabled}
          onClick={() => editor.setOverride("colors", undefined)}
        >
          {t("usePreset")}
        </Button>
      ) : null}
    </div>
  )
}
