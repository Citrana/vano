import { MapPinIcon } from "lucide-react"
import Link from "next/link"
import type { CSSProperties } from "react"
import { cn } from "cn"
import { avatarOverflow, PROFILE_SIZE_PX } from "../../../convex/lib/looks/profile"
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

/** Room for decorations, from `--ov-*` (px, set on the header): literal classes per sizing. */
const ROOM = {
  start: { responsive: "ms-(--ov-l) md:ms-(--ov-l-md)", phone: "ms-(--ov-l)", desktop: "ms-(--ov-l-md)" },
  end: { responsive: "me-(--ov-r) md:me-(--ov-r-md)", phone: "me-(--ov-r)", desktop: "me-(--ov-r-md)" },
  top: { responsive: "mt-(--ov-t) md:mt-(--ov-t-md)", phone: "mt-(--ov-t)", desktop: "mt-(--ov-t-md)" },
  bottom: { responsive: "mb-(--ov-b) md:mb-(--ov-b-md)", phone: "mb-(--ov-b)", desktop: "mb-(--ov-b-md)" },
} as const satisfies Record<string, Record<BannerSizing, string>>

/** Space between the banner and a photo shown below it, px. */
const BELOW_BANNER_PX = 24

/**
 * The px room the header leaves around the photo (`avatarOverflow`), so
 * the decoration, corner and glow are fully visible: never past the shared
 * left edge, never on the name.
 */
function roomVars(profile: ResolvedProfile, belowBanner: boolean): CSSProperties {
  const ov = avatarOverflow({
    shape: profile.shape,
    size: profile.size,
    decoration: profile.decoration,
    corner: profile.corner,
    glow: profile.border?.style === "glow",
  })
  const [phone, desktop] = PROFILE_SIZE_PX[profile.size]
  const px = (units: number, size: number, extra = 0) => `${Math.ceil((units / 100) * size + extra)}px`
  const top = belowBanner ? BELOW_BANNER_PX : 0
  return {
    "--ov-l": px(ov.left, phone),
    "--ov-l-md": px(ov.left, desktop),
    "--ov-r": px(ov.right, phone),
    "--ov-r-md": px(ov.right, desktop),
    "--ov-t": px(ov.top, phone, top),
    "--ov-t-md": px(ov.top, desktop, top),
    "--ov-b": px(ov.bottom, phone),
    "--ov-b-md": px(ov.bottom, desktop),
  } as CSSProperties
}

/**
 * The shop header's markup, without data loading: the server `ShopHeader`
 * and the client look previews render it. The profile photo follows the
 * look (`profile`: shape, border, size, left or centred, on the banner's
 * edge or below it, decoration). Its left edge lines up with the banner
 * and the product grid: no extra padding here, only the room a decoration
 * needs (`roomVars`).
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
        // Pulled over the banner's edge, or below it with room for anything on top.
        pulled ? PULL_UP[sizing] : ROOM.top[sizing],
        // Room for decorations past the photo: inside the shared left edge, clear of the name.
        !centered && ROOM.start[sizing],
        !centered && ROOM.end[sizing],
        ROOM.bottom[sizing],
      )}
    />
  )

  const title = (
    <div className={cn("min-w-0", pulled && !centered && "pt-4")}>
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
    <header style={roomVars(profile, onBanner && !pulled)} className={cn("flex flex-col gap-4", centered && "items-center text-center")}>
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
