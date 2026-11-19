import Image, { type StaticImageData } from "next/image"
import { cn } from "cn"
import type { ResolvedLook } from "../../../convex/lib/looks/resolve"
import { ShopLookScope } from "./look-scope"
import { ShopBanner } from "./shop-banner"

/**
 * A tiny shop drawn in a look (Features page, the editor's Looks grid):
 * banner strip, logo + name bar, chips, two product tiles. Decorative —
 * the caller labels it.
 */
export function LookMini({
  look,
  tiles,
  className,
}: {
  look: ResolvedLook<string>
  tiles: readonly (StaticImageData | string)[]
  className?: string
}) {
  const banner = look.banner.kind === "none" ? null : { ...look.banner, text: null }
  return (
    <ShopLookScope
      look={look}
      className={cn("flex w-full flex-col overflow-hidden rounded-[calc(var(--radius)*1.4)] border", className)}
    >
      {banner ? <ShopBanner banner={banner} sizing="phone" priority={false} className="h-7! sm:h-9!" /> : null}
      <div aria-hidden className="flex flex-col gap-2 p-2 sm:gap-2.5 sm:p-3">
        <div className="flex items-center gap-1.5">
          <span className="size-4 shrink-0 rounded-full bg-muted ring-1 ring-border sm:size-5" />
          <span className="h-1.5 w-10 rounded-full bg-foreground/80 sm:h-2" />
        </div>
        <div className="flex gap-1">
          <span className="shop-chip chip-selected h-3 w-6 rounded-full border sm:h-4 sm:w-8" />
          <span className="shop-chip h-3 w-6 rounded-full border bg-card sm:h-4 sm:w-8" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {tiles.slice(0, 2).map((src, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-[calc(var(--radius)*0.8)] bg-card p-1">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(var(--radius)*0.6)] bg-muted">
                {typeof src === "string" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
                  <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                )}
              </div>
              <span className="h-1 w-3/4 rounded-full bg-foreground/70 sm:h-1.5" />
              <span className="h-1 w-1/2 rounded-full bg-[var(--shop-price)] opacity-80 sm:h-1.5" />
            </div>
          ))}
        </div>
      </div>
    </ShopLookScope>
  )
}
