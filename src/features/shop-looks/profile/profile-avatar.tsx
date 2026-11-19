import { useId, type CSSProperties, type ReactNode } from "react"
import { cn } from "cn"
import {
  cornerBox,
  decorationBox,
  decorationEntry,
  PROFILE_HALO,
  PROFILE_SIZE_PX,
  type Box,
  type ProfileColorToken,
  type ProfileShape,
} from "../../../../convex/lib/looks/profile"
import type { ResolvedProfile } from "../../../../convex/lib/looks/resolve"
import type { BannerSizing } from "../banner-heights"
import { SHAPES } from "../events/shapes"
import { PROFILE_DECORATION_ART, type ProfileBadgeLabels } from "./decorations/art"
import { PROFILE_SHAPE_PATHS } from "./shapes"

export type { ProfileBadgeLabels }

/** Shop colours are drawn with their CSS variable, so the avatar follows the look scope (demo theme switch too). */
const TOKEN_VAR: Record<ProfileColorToken, string> = {
  accent: "var(--primary)",
  chip: "var(--chip)",
  foreground: "var(--foreground)",
}

/** The avatar's box size: `--pf` on phones, `--pf-md` from md up (`sizing` forces one, like banners). */
export const PROFILE_BOX_CLASS: Record<BannerSizing, string> = {
  responsive: "size-(--pf) md:size-(--pf-md)",
  phone: "size-(--pf)",
  desktop: "size-(--pf-md)",
}

export function profileSizeVars(profile: Pick<ResolvedProfile, "size">): CSSProperties {
  const [phone, desktop] = PROFILE_SIZE_PX[profile.size]
  return { "--pf": `${phone}px`, "--pf-md": `${desktop}px` } as CSSProperties
}

/** A shape scaled around its centre so its edge moves in by `inset` box units. */
function scaled(shape: ProfileShape, inset: number) {
  const k = (100 - 2 * inset) / 100
  return { d: PROFILE_SHAPE_PATHS[shape], transform: `translate(${inset} ${inset}) scale(${k})`, k }
}

function Placed({ box, viewBox, children, motion }: { box: Box; viewBox: string; children: ReactNode; motion?: string }) {
  return (
    <g transform={box.rotate ? `rotate(${box.rotate} ${box.x + box.w / 2} ${box.y + box.h / 2})` : undefined}>
      <svg x={box.x} y={box.y} width={box.w} height={box.h} viewBox={viewBox} overflow="visible">
        <g className="profile-deco" data-motion={motion}>
          {children}
        </g>
      </svg>
    </g>
  )
}

/**
 * The shop's profile photo (CLAUDE.md "Shop looks" → "Profile"), one SVG:
 * a halo in the page background (separates it from the banner), the
 * border band, then the photo, always cropped around its centre and inset
 * inside the border, so a border never covers it. No photo: the shop's
 * first letter on the chip colour. Decorations sit around it
 * (`decorationBox`), outside the face zone; overflow is visible so nothing
 * is clipped. Server- and client-safe.
 */
export function ProfileAvatar({
  profile,
  photoUrl,
  name,
  labels,
  sizing = "responsive",
  className,
}: {
  profile: ResolvedProfile
  photoUrl: string | null
  name: string
  labels: ProfileBadgeLabels
  sizing?: BannerSizing
  className?: string
}) {
  const id = useId().replace(/:/g, "")
  const { shape, border } = profile
  const borderPaint = border ? (border.token ? TOKEN_VAR[border.token] : border.color) : null
  const halo = "var(--background)"
  const photoInset = PROFILE_HALO + (border?.units ?? 0)
  const outer = scaled(shape, 0)
  const ring = scaled(shape, PROFILE_HALO)
  const photo = scaled(shape, photoInset)
  const decoration = profile.decoration ? decorationEntry(profile.decoration) : null
  const art = profile.decoration ? PROFILE_DECORATION_ART[profile.decoration] : null
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? ""

  return (
    <span
      aria-hidden
      style={profileSizeVars(profile)}
      className={cn("relative block shrink-0", PROFILE_BOX_CLASS[sizing], className)}
    >
      <svg viewBox="0 0 100 100" overflow="visible" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <clipPath id={`${id}-clip`}>
            <path d={photo.d} transform={photo.transform} />
          </clipPath>
          {border?.style === "glow" ? (
            <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          ) : null}
        </defs>

        {border?.style === "glow" && borderPaint ? (
          <path d={ring.d} transform={ring.transform} style={{ fill: borderPaint }} opacity={0.55} filter={`url(#${id}-glow)`} />
        ) : null}
        <path d={outer.d} transform={outer.transform} style={{ fill: halo }} />

        {border && borderPaint ? (
          border.style === "dashed" ? (
            (() => {
              const mid = scaled(shape, PROFILE_HALO + border.units / 2)
              return (
                <path
                  d={mid.d}
                  transform={mid.transform}
                  fill="none"
                  style={{ stroke: borderPaint }}
                  strokeWidth={border.units / mid.k}
                  strokeDasharray={`${(border.units * 1.6) / mid.k} ${(border.units * 1.1) / mid.k}`}
                  strokeLinecap="round"
                />
              )
            })()
          ) : border.style === "double" ? (
            (() => {
              const gap = scaled(shape, PROFILE_HALO + border.units * 0.36)
              const inner = scaled(shape, PROFILE_HALO + border.units * 0.64)
              return (
                <>
                  <path d={ring.d} transform={ring.transform} style={{ fill: borderPaint }} />
                  <path d={gap.d} transform={gap.transform} style={{ fill: halo }} />
                  <path d={inner.d} transform={inner.transform} style={{ fill: borderPaint }} />
                </>
              )
            })()
          ) : (
            <path d={ring.d} transform={ring.transform} style={{ fill: borderPaint }} />
          )
        ) : null}

        {photoUrl ? (
          <>
            <path d={photo.d} transform={photo.transform} style={{ fill: "var(--card)" }} />
            <image
              href={photoUrl}
              x={photoInset}
              y={photoInset}
              width={100 - 2 * photoInset}
              height={100 - 2 * photoInset}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${id}-clip)`}
            />
          </>
        ) : (
          <>
            <path d={photo.d} transform={photo.transform} style={{ fill: "var(--chip)" }} />
            <text
              x="50"
              y="52"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="42"
              fontWeight="700"
              className="font-heading"
              style={{ fill: "var(--chip-foreground)" }}
            >
              {initial}
            </text>
          </>
        )}

        {decoration && art ? (
          <Placed box={decorationBox(decoration, shape, profile.size)} viewBox={art.viewBox} motion={decoration.motion}>
            {art.draw({ halo: profile.halo, labels })}
          </Placed>
        ) : null}

        {profile.corner !== "none" ? (
          <Placed box={cornerBox(shape, profile.size, profile.decoration)} viewBox="0 0 100 100" motion="twinkle">
            <path d={SHAPES[profile.corner].d} style={{ fill: halo, stroke: halo }} strokeWidth={22} strokeLinejoin="round" />
            <path d={SHAPES[profile.corner].d} style={{ fill: borderPaint ?? "var(--primary)" }} />
          </Placed>
        ) : null}
      </svg>
    </span>
  )
}
