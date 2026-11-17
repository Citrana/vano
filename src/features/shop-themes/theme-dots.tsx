"use client"

import { useTranslations } from "next-intl"
import { cn } from "cn"
import { SHOP_THEMES, THEME_SWATCH, type ShopTheme } from "./themes"

/** Tappable theme swatches (radio group semantics, 44px targets). */
export function ThemeDots({
  value,
  onChange,
  className,
}: {
  value: ShopTheme
  onChange: (theme: ShopTheme) => void
  className?: string
}) {
  const t = useTranslations("ShopThemes")
  return (
    <div role="radiogroup" aria-label={t("label")} className={cn("flex items-center gap-1", className)}>
      {SHOP_THEMES.map((theme) => {
        const { bg, accent } = THEME_SWATCH[theme]
        const selected = theme === value
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(theme)}
            onClick={() => onChange(theme)}
            className="group flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
