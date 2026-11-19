"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { cn } from "cn"
import { DEMO_PRODUCTS } from "@/features/marketing/demo/demo-shop"
import { LookMini } from "@/features/shop-looks/look-mini"
import { PRESET_IDS, PRESET_LOOKS, type PresetId } from "@/features/shop-looks/presets"

const TILES = [DEMO_PRODUCTS[0].photos[0], DEMO_PRODUCTS[3].photos[0]]

/**
 * Mini shop previews, one per preset, each drawn with the real look
 * tokens (the same presets sellers pick). Picking one highlights it.
 */
export function ThemePreviews() {
  const t = useTranslations("ShopLooks")
  const [selected, setSelected] = useState<PresetId>("blush")

  return (
    <div role="radiogroup" aria-label={t("label")} className="grid grid-cols-3 gap-3 sm:gap-4">
      {PRESET_IDS.map((preset) => {
        const active = preset === selected
        return (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setSelected(preset)}
            className="group flex flex-col items-center gap-2 rounded-xl focus-ring"
          >
            <LookMini
              look={PRESET_LOOKS[preset]}
              tiles={TILES}
              className={cn(
                "transition-[translate,box-shadow] duration-300 motion-reduce:transition-none",
                active ? "-translate-y-1 ring-2 ring-plum" : "group-hover:-translate-y-0.5",
              )}
            />
            <span className={cn("text-center text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
              {t(`presets.${preset}`)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
