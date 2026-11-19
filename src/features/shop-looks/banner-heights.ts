import type { BannerHeight } from "../../../convex/lib/looks/banners"

export type BannerSizing = "responsive" | "phone" | "desktop"

/**
 * Fixed banner heights per size, so nothing moves while images or fonts
 * load. `phone` / `desktop` force one layout (previews and mockups).
 */
export const BANNER_HEIGHT_CLASS: Record<BannerHeight, Record<BannerSizing, string>> = {
  sm: { responsive: "h-28 md:h-40", phone: "h-28", desktop: "h-40" },
  md: { responsive: "h-40 md:h-56", phone: "h-40", desktop: "h-56" },
  lg: { responsive: "h-52 md:h-72", phone: "h-52", desktop: "h-72" },
}
