import Image from "next/image"
import { cn } from "cn"
import { ARTWORK_BASE, type BannerHeight } from "../../../convex/lib/looks/banners"
import type { ResolvedBanner } from "../../../convex/lib/looks/resolve"
import { ARTWORK_IMAGES } from "./artworks"

/** Fixed heights per size, so nothing moves while the image loads. */
export const BANNER_HEIGHT_CLASS: Record<BannerHeight, { responsive: string; phone: string }> = {
  sm: { responsive: "h-28 md:h-40", phone: "h-28" },
  md: { responsive: "h-40 md:h-56", phone: "h-40" },
  lg: { responsive: "h-52 md:h-72", phone: "h-52" },
}

/**
 * The shop banner (CLAUDE.md "Shop looks"): a photo (focal point + zoom),
 * a curated gradient or a ready-made artwork, with optional short text.
 * Gradient text uses the gradient's tested colour; text over a photo or
 * artwork sits on a panel in the shop's own colours, so it's always
 * readable. `sizing="phone"` keeps mobile heights inside a phone mockup.
 */
export function ShopBanner({
  banner,
  sizing = "responsive",
  priority = true,
  className,
}: {
  banner: ResolvedBanner<string>
  sizing?: "responsive" | "phone"
  priority?: boolean
  className?: string
}) {
  if (banner.kind === "none") return null
  const height = BANNER_HEIGHT_CLASS[banner.height][sizing]
  const text = banner.text

  return (
    <div
      className={cn("relative isolate flex overflow-hidden", height, className)}
      style={
        banner.kind === "gradient"
          ? { backgroundImage: banner.css }
          : banner.kind === "artwork"
            ? { backgroundColor: ARTWORK_BASE[banner.artworkId] }
            : undefined
      }
    >
      {banner.kind === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element -- Convex storage / blob URL
        <img
          src={banner.image}
          alt=""
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="absolute inset-0 -z-10 size-full object-cover"
          style={{
            objectPosition: `${banner.focusX}% ${banner.focusY}%`,
            transform: banner.zoom > 1 ? `scale(${banner.zoom})` : undefined,
            transformOrigin: `${banner.focusX}% ${banner.focusY}%`,
          }}
        />
      ) : null}
      {banner.kind === "artwork" ? (
        <Image
          src={ARTWORK_IMAGES[banner.artworkId]}
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          className="-z-10 object-cover"
        />
      ) : null}
      {text ? (
        <div
          className={cn(
            "flex w-full items-end p-4 md:p-6",
            text.align === "center" ? "items-center justify-center text-center" : "justify-start",
          )}
        >
          <p
            className={cn(
              "max-w-[28ch] font-heading text-lg leading-snug font-bold tracking-tight text-balance md:text-2xl",
              banner.kind === "gradient" ? "" : "rounded-lg bg-background/90 px-3 py-2 text-foreground",
            )}
            style={banner.kind === "gradient" ? { color: banner.textColor } : undefined}
          >
            {text.value}
          </p>
        </div>
      ) : null}
    </div>
  )
}
