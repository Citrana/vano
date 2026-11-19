"use client"

import { useTranslations } from "next-intl"
import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { PresetSwatches } from "@/features/shop-looks/preset-swatches"
import { PRESET_LOOKS, SHOWCASE_PRESETS, type PresetId } from "@/features/shop-looks/presets"
import { ShopPreview } from "@/features/shop-looks/shop-preview"

/*
 * Look of the Home phone: the same presets sellers pick (CLAUDE.md "Shop
 * looks"). Cycles through the showcase looks every few seconds, pauses
 * while the visitor hovers or focuses the phone, and stops for good once
 * they pick one. No auto-cycle with reduced motion.
 */
type State = { preset: PresetId; auto: boolean; paused: boolean }
const INITIAL: State = { preset: SHOWCASE_PRESETS[0], auto: true, paused: false }
const INTERVAL_MS = 4000
let state: State = INITIAL
const listeners = new Set<() => void>()

function update(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function usePhoneLook(): State {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL)
}

/** The phone screen; re-draws (with a short fade) whenever the look changes. */
export function PhoneThemeScreen({ zoomClassName, children }: { zoomClassName: string; children: ReactNode }) {
  const { preset } = usePhoneLook()
  return (
    <div
      className="size-full"
      onPointerEnter={() => update({ paused: true })}
      onPointerLeave={() => update({ paused: false })}
    >
      <div key={preset} className="size-full animate-in duration-500 fade-in motion-reduce:animate-none">
        <ShopPreview look={PRESET_LOOKS[preset]} zoomClassName={zoomClassName}>
          {children}
        </ShopPreview>
      </div>
    </div>
  )
}

/** Look name + tappable swatches under the phone; drives the auto-cycle. */
export function PhoneThemeControls() {
  const t = useTranslations("Home")
  const tl = useTranslations("ShopLooks")
  const { preset, auto, paused } = usePhoneLook()

  useEffect(() => {
    if (!auto || paused) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      const i = SHOWCASE_PRESETS.indexOf(state.preset as (typeof SHOWCASE_PRESETS)[number])
      update({ preset: SHOWCASE_PRESETS[(i + 1) % SHOWCASE_PRESETS.length] })
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [auto, paused])

  return (
    <div
      className="flex flex-col items-center gap-0.5 text-sm sm:flex-row sm:justify-center sm:gap-1"
      onFocus={() => update({ paused: true })}
      onBlur={() => update({ paused: false })}
    >
      <span>
        <span className="text-muted-foreground">{t("themeLabel")}</span>{" "}
        <span className="font-semibold">{tl(`presets.${preset}`)}</span>
      </span>
      <PresetSwatches
        options={SHOWCASE_PRESETS}
        value={preset}
        onChange={(next) => update({ preset: next, auto: false })}
      />
    </div>
  )
}
