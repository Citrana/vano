"use client"

import { LockIcon, RotateCcwIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { StaticImageData } from "next/image"
import { cn } from "cn"
import { FREE_PRESET } from "../../../../convex/lib/looks/presets"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LookMini } from "../look-mini"
import { PRESET_IDS, PRESET_LOOKS } from "../presets"
import { radioKeyDown } from "./choice-group"
import type { LookEditorState } from "./use-look-editor"

/** Ready-made looks: one tap applies colours, buttons and banner. */
export function LooksSection({
  editor,
  entitled,
  disabled,
  tiles,
}: {
  editor: LookEditorState
  entitled: boolean
  disabled: boolean
  tiles: readonly (StaticImageData | string)[]
}) {
  const t = useTranslations("LookEditor")
  const tl = useTranslations("ShopLooks")
  const current = editor.draft.preset
  const index = PRESET_IDS.indexOf(current)
  // The event banner is its own section; "reset" leaves it alone.
  const customized = Object.entries(editor.draft.overrides).some(([key, v]) => key !== "promo" && v !== undefined)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("looks.current", { name: tl(`presets.${current}`) })}
          {customized ? ` · ${t("looks.customized")}` : ""}
        </p>
        {customized ? (
          <Button type="button" variant="ghost" size="sm" onClick={editor.resetToPreset} disabled={disabled}>
            <RotateCcwIcon />
            {t("actions.reset")}
          </Button>
        ) : null}
      </div>
      <div role="radiogroup" aria-label={t("sections.looks")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PRESET_IDS.map((preset, i) => {
          const selected = preset === current
          const locked = !entitled && preset !== FREE_PRESET
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (index < 0 && i === 0) ? 0 : -1}
              disabled={disabled}
              onClick={() => editor.applyPreset(preset)}
              onKeyDown={(e) => radioKeyDown(e, i, PRESET_IDS.length, (n) => editor.applyPreset(PRESET_IDS[n]))}
              className="group flex flex-col gap-2 rounded-xl text-left focus-ring disabled:opacity-60"
            >
              <span className="relative block">
                <LookMini
                  look={PRESET_LOOKS[preset]}
                  tiles={tiles}
                  className={cn(
                    "transition-[translate,box-shadow] duration-200 motion-reduce:transition-none",
                    selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "group-hover:-translate-y-0.5",
                  )}
                />
                {locked ? (
                  <Badge className="absolute top-1.5 right-1.5 gap-1">
                    <LockIcon className="size-3" aria-hidden />
                    {t("looks.pro")}
                  </Badge>
                ) : null}
              </span>
              <span className={cn("text-sm font-semibold", selected ? "text-foreground" : "text-muted-foreground")}>
                {tl(`presets.${preset}`)}
                {locked ? <span className="sr-only"> ({t("looks.lockedHint")})</span> : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
