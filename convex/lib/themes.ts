import { v } from "convex/values";

/**
 * Shop looks a seller can pick (stored on `shops.theme`). Tokens live in
 * src/app/globals.css under [data-shop-theme="…"]. Public pages don't
 * apply the stored look yet.
 */
export const SHOP_THEMES = ["bold", "soft", "dark"] as const;
export type ShopTheme = (typeof SHOP_THEMES)[number];

export const shopThemeValidator = v.union(
  v.literal("bold"),
  v.literal("soft"),
  v.literal("dark"),
);
