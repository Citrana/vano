/**
 * Shop looks. Tokens live in src/app/globals.css under
 * [data-shop-theme="…"]; this list drives pickers and swatches. The seller
 * theme picker (next task) will store one of these ids on the shop.
 */
export const SHOP_THEMES = ["bold", "soft", "dark"] as const
export type ShopTheme = (typeof SHOP_THEMES)[number]

/** Swatch colors for the theme dots (background + accent). */
export const THEME_SWATCH: Record<ShopTheme, { bg: string; accent: string }> = {
  bold: { bg: "#fff8f3", accent: "#1a1412" },
  soft: { bg: "#ffe3d6", accent: "#5b1f4a" },
  dark: { bg: "#1a1412", accent: "#f4511e" },
}
