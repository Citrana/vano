import type { ShopTheme } from "../../../convex/lib/themes"

/**
 * Shop looks. The list (and the validator) live in convex/lib/themes.ts;
 * tokens live in src/app/globals.css under [data-shop-theme="…"]. Sellers
 * pick one in Shop settings (stored on `shops.theme`).
 */
export { SHOP_THEMES, type ShopTheme } from "../../../convex/lib/themes"

/** Swatch colors for the theme dots (background + accent). */
export const THEME_SWATCH: Record<ShopTheme, { bg: string; accent: string }> = {
  bold: { bg: "#fff8f3", accent: "#1a1412" },
  soft: { bg: "#ffe3d6", accent: "#5b1f4a" },
  dark: { bg: "#1a1412", accent: "#f4511e" },
}
