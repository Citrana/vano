"use client"

import { useTranslations } from "next-intl"
import { cn } from "cn"
import { presetSwatch, type PresetId } from "./presets"

/** Tappable preset swatches (radio group semantics, 44px targets). */
export function PresetSwatches({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly PresetId[]
  /** null = nothing picked yet. */
  value: PresetId | null
  onChange: (preset: PresetId) => void
  className?: string
}) {
  const t = useTranslations("ShopLooks")
  return (
    <div role="radiogroup" aria-label={t("label")} className={cn("flex items-center gap-0.5", className)}>
      {options.map((preset) => {
        const { bg, accent } = presetSwatch(preset)
        const selected = preset === value
        return (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(`presets.${preset}`)}
            onClick={() => onChange(preset)}
            className="group flex size-11 items-center justify-center rounded-full focus-ring"
          >
            <span
              className={cn(
                "size-6 rounded-full ring-1 ring-foreground/15 transition-transform",
                selected ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background" : "group-hover:scale-105",
              )}
              style={{ background: `linear-gradient(135deg, ${bg} 50%, ${accent} 50%)` }}
            />
          </button>
        )
      })}
    </div>
  )
}
