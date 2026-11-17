"use client"

import { useSyncExternalStore, type ReactNode } from "react"
import { cn } from "cn"
import { ThemeDots } from "@/features/shop-themes/theme-dots"
import { SHOP_THEMES, type ShopTheme } from "@/features/shop-themes/themes"

/*
 * The demo shop's look, shared by the theme switch and the themed area and
 * remembered for the browser session when storage works. The server (and
 * first paint) always uses "bold".
 */
const STORAGE_KEY = "vano.demoTheme"
const DEFAULT: ShopTheme = "bold"
const listeners = new Set<() => void>()
let current: ShopTheme | null = null

function readSaved(): ShopTheme {
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY)
    if (saved && (SHOP_THEMES as readonly string[]).includes(saved)) return saved as ShopTheme
  } catch {
    // Storage blocked: default look.
  }
  return DEFAULT
}

function getSnapshot(): ShopTheme {
  current ??= readSaved()
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setDemoTheme(theme: ShopTheme) {
  current = theme
  try {
    window.sessionStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Ignore: the choice just won't survive a reload.
  }
  listeners.forEach((l) => l())
}

function useDemoTheme(): ShopTheme {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT)
}

/** The themed area: shop tokens change inside, the marketing chrome doesn't. */
export function DemoThemeScope({ children, className }: { children: ReactNode; className?: string }) {
  const theme = useDemoTheme()
  return (
    <div data-shop-theme={theme} className={cn("transition-colors duration-300 motion-reduce:transition-none", className)}>
      {children}
    </div>
  )
}

export function DemoThemeSwitch({ label }: { label: string }) {
  const theme = useDemoTheme()
  return (
    <div className="flex items-center gap-1 text-sm font-medium">
      <span className="text-muted-foreground">{label}</span>
      <ThemeDots value={theme} onChange={setDemoTheme} />
    </div>
  )
}
