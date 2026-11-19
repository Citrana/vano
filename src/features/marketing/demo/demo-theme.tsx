"use client"

import { useSyncExternalStore, type ReactNode } from "react"
import { cn } from "cn"
import { ShopLookScope } from "@/features/shop-looks/look-scope"
import { PresetSwatches } from "@/features/shop-looks/preset-swatches"
import { isPresetId, PRESET_LOOKS, SHOWCASE_PRESETS, type PresetId } from "@/features/shop-looks/presets"
import { ShopBanner } from "@/features/shop-looks/shop-banner"

/*
 * The demo shop's look: the same presets sellers pick (CLAUDE.md "Shop
 * looks"), shared by the switch, the themed area and the banner, and
 * remembered for the browser session when storage works. The server (and
 * first paint) always uses the first showcase look.
 */
const STORAGE_KEY = "vano.demoLook"
const DEFAULT: PresetId = SHOWCASE_PRESETS[0]
const listeners = new Set<() => void>()
let current: PresetId | null = null

function readSaved(): PresetId {
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY)
    if (saved && isPresetId(saved)) return saved
  } catch {
    // Storage blocked: default look.
  }
  return DEFAULT
}

function getSnapshot(): PresetId {
  current ??= readSaved()
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setDemoLook(preset: PresetId) {
  current = preset
  try {
    window.sessionStorage.setItem(STORAGE_KEY, preset)
  } catch {
    // Ignore: the choice just won't survive a reload.
  }
  listeners.forEach((l) => l())
}

function useDemoLook(): PresetId {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT)
}

/** The themed area: shop tokens change inside, the marketing chrome doesn't. */
export function DemoThemeScope({ children, className }: { children: ReactNode; className?: string }) {
  const preset = useDemoLook()
  return (
    <ShopLookScope
      look={PRESET_LOOKS[preset]}
      className={cn("transition-colors duration-300 motion-reduce:transition-none", className)}
    >
      {children}
    </ShopLookScope>
  )
}

/** The demo shop's banner, in the current look. */
export function DemoLookBanner({ className }: { className?: string }) {
  const preset = useDemoLook()
  return <ShopBanner banner={PRESET_LOOKS[preset].banner} className={className} />
}

export function DemoThemeSwitch({ label }: { label: string }) {
  const preset = useDemoLook()
  return (
    <div className="flex items-center gap-1 text-sm font-medium">
      <span className="text-muted-foreground">{label}</span>
      <PresetSwatches options={SHOWCASE_PRESETS} value={preset} onChange={setDemoLook} />
    </div>
  )
}
