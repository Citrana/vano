"use client"

import { useTranslations } from "next-intl"
import Image from "next/image"
import { useState } from "react"
import { cn } from "cn"
import { DEMO_PRODUCTS } from "@/features/marketing/demo/demo-shop"
import { SHOP_THEMES, type ShopTheme } from "@/features/shop-themes/themes"

const TILES = [DEMO_PRODUCTS[0], DEMO_PRODUCTS[3]]

/**
 * Three mini shop previews (bold / soft / dark), each drawn inside its own
 * theme scope with the real theme tokens. Picking one highlights it.
 */
export function ThemePreviews() {
  const t = useTranslations("ShopThemes")
  const [selected, setSelected] = useState<ShopTheme>("bold")

  return (
    <div role="radiogroup" aria-label={t("label")} className="grid grid-cols-3 gap-3 sm:gap-4">
      {SHOP_THEMES.map((theme) => {
        const active = theme === selected
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setSelected(theme)}
            className="group flex flex-col items-center gap-2 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div
              data-shop-theme={theme}
              aria-hidden
              className={cn(
                "flex w-full flex-col gap-2 overflow-hidden rounded-[calc(var(--radius)*1.4)] p-2 ring-1 ring-foreground/10 transition-[translate,box-shadow] duration-300 motion-reduce:transition-none sm:gap-2.5 sm:p-3",
                active ? "-translate-y-1 shadow-lift ring-2 ring-plum" : "shadow-soft group-hover:-translate-y-0.5",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="size-4 shrink-0 rounded-full bg-muted ring-1 ring-border sm:size-5" />
                <span className="h-1.5 w-10 rounded-full bg-foreground/80 sm:h-2" />
              </div>
              <div className="flex gap-1">
                <span className="chip-selected h-3 w-6 rounded-full border sm:h-4 sm:w-8" />
                <span className="h-3 w-6 rounded-full border bg-card sm:h-4 sm:w-8" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {TILES.map((p) => (
                  <div key={p.id} className="flex flex-col gap-1 rounded-[calc(var(--radius)*0.8)] bg-card p-1">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(var(--radius)*0.6)] bg-muted">
                      <Image src={p.photos[0]} alt="" fill sizes="80px" className="object-cover" />
                    </div>
                    <span className="h-1 w-3/4 rounded-full bg-foreground/70 sm:h-1.5" />
                    <span className="h-1 w-1/2 rounded-full bg-muted-foreground/60 sm:h-1.5" />
                  </div>
                ))}
              </div>
            </div>
            <span className={cn("text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>{t(theme)}</span>
          </button>
        )
      })}
    </div>
  )
}
