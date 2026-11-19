import { MapPinIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "cn"
import { decorationEntry } from "../../../convex/lib/looks/profile"
import { FREE_LOOK } from "../../../convex/lib/looks/presets"
import { resolveLook, type ResolvedProfile } from "../../../convex/lib/looks/resolve"
import type { BannerSizing } from "@/features/shop-looks/banner-heights"
import { ProfileAvatar, type ProfileBadgeLabels } from "@/features/shop-looks/profile/profile-avatar"
import type { PublicShop } from "./data"

/** What the header needs; the demo shop (no Convex id, no location) fits too. */
export type HeaderShop = Pick<PublicShop, "name" | "slug" | "language" | "logoUrl" | "description"> &
  Partial<Pick<PublicShop, "city" | "country">>

/** Today's profile photo (the free look's), for pages without a look of their own. */
export const DEFAULT_RESOLVED_PROFILE: ResolvedProfile = resolveLook(FREE_LOOK).profile

/** Pull the photo up by half its height over the banner's bottom edge. */
const PULL_UP: Record<BannerSizing, string> = {
  responsive: "-mt-[calc(var(--pf)/2)] md:-mt-[calc(var(--pf-md)/2)]",
  phone: "-mt-[calc(var(--pf)/2)]",
  desktop: "-mt-[calc(var(--pf-md)/2)]",
}

/**
 * The shop header's markup, without data loading: the server `ShopHeader`
 * and the client look previews render it. The profile photo follows the
 * look (`profile`: shape, border, size, left or centred, on the banner's
 * edge or below it, decoration). Its left edge lines up with the banner
 * and the product grid: no extra padding here.
 */
export function ShopHeaderView({
  shop,
  locationLabel,
  labels,
  profile = DEFAULT_RESOLVED_PROFILE,
  compact = false,
  onBanner = false,
  sizing = "responsive",
}: {
  shop: HeaderShop
  /** "Goma, DR Congo" in the shop's language, or null. */
  locationLabel: string | null
  /** Words for text decorations, in the shop's language. */
  labels: ProfileBadgeLabels
  profile?: ResolvedProfile
  compact?: boolean
  onBanner?: boolean
  /** `phone` / `desktop` force one layout (previews), like the banner. */
  sizing?: BannerSizing
}) {
  if (compact) {
    return (
      <Link href={`/${shop.slug}`} className="flex min-w-0 items-center gap-3">
        <ProfileAvatar
          profile={{ ...profile, decoration: null, corner: "none" }}
          photoUrl={shop.logoUrl}
          name={shop.name}
          labels={labels}
          className="size-10 md:size-10"
        />
        <span className="truncate font-heading text-lg font-bold tracking-tight">{shop.name}</span>
      </Link>
    )
  }

  const centered = profile.position === "center"
  const anchor = profile.decoration ? decorationEntry(profile.decoration).anchor : null
  const pulled = onBanner && profile.overlap === "edge"
  const avatar = (
    <ProfileAvatar
      profile={profile}
      photoUrl={shop.logoUrl}
      name={shop.name}
      labels={labels}
      sizing={sizing}
      className={cn(
        "z-10",
        pulled ? PULL_UP[sizing] : onBanner ? "mt-4" : null,
        // Room for decorations that reach past the photo, so they never touch the text.
        !pulled && (anchor === "top" || anchor === "topSide") && "mt-[calc(var(--pf)*0.3)]",
        !centered && anchor === "side" && "me-[calc(var(--pf)*0.18)]",
        (anchor === "badge" || anchor === "sticker" || anchor === "ring") && "mb-[calc(var(--pf)*0.1)]",
      )}
    />
  )

  const title = (
    <div className={cn("min-w-0", pulled && !centered && "pt-2")}>
      <h1 className="font-heading text-2xl leading-tight font-bold tracking-tight text-balance md:text-3xl">{shop.name}</h1>
      {locationLabel ? (
        <p className={cn("mt-1 flex items-center gap-1 text-sm text-muted-foreground", centered && "justify-center")}>
          <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
          {locationLabel}
        </p>
      ) : null}
    </div>
  )

  return (
    <header className={cn("flex flex-col gap-3", centered && "items-center text-center")}>
      {centered ? (
        <>
          {avatar}
          {title}
        </>
      ) : (
        <div className={cn("flex gap-4", pulled ? "items-end" : "items-center")}>
          {avatar}
          {title}
        </div>
      )}
      {shop.description ? (
        <p className={cn("max-w-2xl text-pretty text-muted-foreground", centered && "mx-auto")}>{shop.description}</p>
      ) : null}
    </header>
  )
}
