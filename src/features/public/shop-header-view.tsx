import { MapPinIcon, StoreIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "cn"
import type { PublicShop } from "./data"

/** What the header needs; the demo shop (no Convex id, no location) fits too. */
export type HeaderShop = Pick<PublicShop, "name" | "slug" | "language" | "logoUrl" | "description"> &
  Partial<Pick<PublicShop, "city" | "country">>

/**
 * The shop header's markup, without data loading: the server `ShopHeader`
 * and the client look preview both render it. `onBanner` pulls the logo
 * up over the banner above it.
 */
export function ShopHeaderView({
  shop,
  locationLabel,
  compact = false,
  onBanner = false,
}: {
  shop: HeaderShop
  /** "Goma, DR Congo" in the shop's language, or null. */
  locationLabel: string | null
  compact?: boolean
  onBanner?: boolean
}) {
  const logo = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-card",
        compact ? "size-10" : "size-16 md:size-20",
        onBanner && !compact && "-mt-10 ring-4 ring-background md:-mt-12",
      )}
    >
      {shop.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
        <img src={shop.logoUrl} alt="" className="size-full object-cover" />
      ) : (
        <StoreIcon className="size-1/2 text-muted-foreground" aria-hidden />
      )}
    </span>
  )

  if (compact) {
    return (
      <Link href={`/${shop.slug}`} className="flex min-w-0 items-center gap-3">
        {logo}
        <span className="truncate font-heading text-lg font-bold tracking-tight">{shop.name}</span>
      </Link>
    )
  }

  return (
    <header className="flex flex-col gap-3">
      <div className={cn("flex gap-4", onBanner ? "items-end" : "items-center")}>
        {logo}
        <div className="min-w-0">
          <h1 className="font-heading text-2xl leading-tight font-bold tracking-tight text-balance md:text-3xl">{shop.name}</h1>
          {locationLabel ? (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
              {locationLabel}
            </p>
          ) : null}
        </div>
      </div>
      {shop.description ? <p className="max-w-2xl text-pretty text-muted-foreground">{shop.description}</p> : null}
    </header>
  )
}
