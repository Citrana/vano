"use client"

import { useTranslations } from "next-intl"
import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { ThemeDots } from "@/features/shop-themes/theme-dots"
import { SHOP_THEMES, type ShopTheme } from "@/features/shop-themes/themes"

/*
 * Theme of the Home phone. Cycles bold → soft → dark every few seconds,
 * pauses while the visitor hovers or focuses the phone, and stops for good
 * once they pick a look. No auto-cycle with reduced motion.
 */
type State = { theme: ShopTheme; auto: boolean; paused: boolean }
const INITIAL: State = { theme: "bold", auto: true, paused: false }
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
function usePhoneTheme(): State {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL)
}

/** The phone screen; re-themes (with a short fade) whenever the look changes. */
export function PhoneThemeScreen({ children }: { children: ReactNode }) {
  const { theme } = usePhoneTheme()
  return (
    <div
      data-shop-theme={theme}
      className="size-full"
      onPointerEnter={() => update({ paused: true })}
      onPointerLeave={() => update({ paused: false })}
    >
      <div key={theme} className="size-full animate-in duration-500 fade-in motion-reduce:animate-none">
        {children}
      </div>
    </div>
  )
}

/** Theme name + tappable dots under the phone; drives the auto-cycle. */
export function PhoneThemeControls() {
  const t = useTranslations("Home")
  const ts = useTranslations("ShopThemes")
  const { theme, auto, paused } = usePhoneTheme()

  useEffect(() => {
    if (!auto || paused) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      const next = SHOP_THEMES[(SHOP_THEMES.indexOf(state.theme) + 1) % SHOP_THEMES.length]
      update({ theme: next })
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [auto, paused])

  return (
    <div
      className="flex items-center justify-center gap-1 text-sm"
      onFocus={() => update({ paused: true })}
      onBlur={() => update({ paused: false })}
    >
      <span className="text-muted-foreground">{t("themeLabel")}</span>
      <span className="min-w-14 font-semibold">{ts(theme)}</span>
      <ThemeDots value={theme} onChange={(next) => update({ theme: next, auto: false })} />
    </div>
  )
}
