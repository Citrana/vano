import type { CSSProperties } from "react"
import { cn } from "cn"
import { STICKER_FILES } from "@/assets/images/stickers/files"
import { isStickerId, stickerById } from "@/assets/images/stickers/manifest"
import { eventPaletteCss, type EventPalette } from "../../../../convex/lib/looks/events"
import type { ResolvedEventBanner } from "../../../../convex/lib/looks/resolve"
import { BANNER_HEIGHT_CLASS, type BannerSizing } from "../banner-heights"
import { EVENT_FONT_CLASS, EVENT_FONT_SCALE } from "./fonts"
import { SHAPES } from "./shapes"
import { TEMPLATE_LAYERS } from "./templates"
import type { ZonePoint } from "./templates/types"

/**
 * Where an event banner is drawn: the shop banner (fixed heights), or a
 * download / preview whose parent sets the size: `square` and `story`
 * use top / bottom decoration bands, `wide` and `banner` side zones.
 */
export type EventBannerFormat = "banner" | "wide" | "square" | "story"

const isTall = (format: EventBannerFormat) => format === "square" || format === "story"

/**
 * Sizes from the banner itself (a CSS size container), so the same design
 * fits a 360px phone, a 1440px screen and a 1080×1920 status image:
 * - wide: side zones of `--zone` (wider on very wide banners, so the
 *   decoration fills them), headline sized so 32 characters fit in 2 lines;
 * - tall: top / bottom bands, headline up to 3 lines.
 * The text box sits between the zones and clips nothing: line-clamped,
 * words wrap anywhere.
 */
function layoutVars(format: EventBannerFormat, scale: number): CSSProperties {
  if (isTall(format)) {
    return {
      "--zone": "24cqh",
      "--headline": `clamp(1rem, calc(min(10cqh, 13cqw) * ${scale}), 8rem)`,
      "--subline": "clamp(0.75rem, min(3.6cqh, 4.6cqw), 3rem)",
    } as CSSProperties
  }
  return {
    "--zone": "max(min(40cqh, 24cqw), calc((100cqw - 300cqh) / 2))",
    "--headline": `clamp(0.95rem, calc(min(17cqh, (100cqw - 2 * var(--zone)) / 9.5) * ${scale}), 5rem)`,
    "--subline": "clamp(0.75rem, min(8cqh, (100cqw - 2 * var(--zone)) / 22), 1.75rem)",
  } as CSSProperties
}

/** Places an item inside a zone; the second zone mirrors the first. */
function zoneStyle(point: ZonePoint, side: 0 | 1, tall: boolean): CSSProperties {
  const along = side === 0 ? point.t : 1 - point.t
  const across = side === 0 ? point.u : 1 - point.u
  return {
    position: "absolute",
    left: `${(tall ? along : across) * 100}%`,
    top: `${(tall ? across : along) * 100}%`,
    width: `${point.size * 100}cqmin`,
    height: `${point.size * 100}cqmin`,
    transform: `translate(-50%, -50%) rotate(${point.rotate ?? 0}deg)`,
  }
}

function Sticker({ id, palette, style }: { id: string; palette: EventPalette; style: CSSProperties }) {
  if (!isStickerId(id)) return null // a sticker retired from the set
  const src = STICKER_FILES[id].src
  if (stickerById(id).tint === "none") {
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, sized by its slot
    return <img src={src} alt="" style={{ ...style, objectFit: "contain" }} />
  }
  const mask = `url("${src}") center / contain no-repeat`
  return <span style={{ ...style, backgroundColor: palette.sticker, mask, WebkitMask: mask }} />
}

/**
 * An event & promo banner (CLAUDE.md "Shop looks"): palette background,
 * template shapes, the seller's stickers and text, all in code, so it's
 * sharp everywhere and light to load. Server-safe. The same component
 * draws the shop banner, the editor preview, the admin card and the
 * downloads.
 */
export function EventBanner({
  banner,
  format = "banner",
  sizing = "responsive",
  className,
}: {
  banner: ResolvedEventBanner
  format?: EventBannerFormat
  sizing?: BannerSizing
  className?: string
}) {
  const layers = TEMPLATE_LAYERS[banner.template]
  const tall = isTall(format)
  const { palette } = banner
  const sides = [0, 1] as const

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden [container-type:size]",
        format === "banner" ? BANNER_HEIGHT_CLASS[banner.height][sizing] : "size-full",
        className,
      )}
      style={{ backgroundImage: eventPaletteCss(palette), ...layoutVars(format, EVENT_FONT_SCALE[banner.font]) }}
    >
      {sides.map((side) => (
        <div
          key={side}
          aria-hidden
          className="pointer-events-none absolute overflow-hidden [container-type:size]"
          style={
            tall
              ? { left: 0, right: 0, height: "var(--zone)", [side === 0 ? "top" : "bottom"]: 0 }
              : { top: 0, bottom: 0, width: "var(--zone)", [side === 0 ? "left" : "right"]: 0 }
          }
        >
          {layers.decor.map((item, i) => {
            const shape = SHAPES[item.shape]
            const color = palette.shapes[item.tone]
            const stroke = "stroke" in shape ? shape.stroke : undefined
            return (
              <svg key={i} viewBox="0 0 100 100" overflow="visible" style={{ ...zoneStyle(item, side, tall), opacity: item.opacity }}>
                <path
                  d={shape.d}
                  fill={stroke ? "none" : color}
                  stroke={stroke ? color : undefined}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                />
              </svg>
            )
          })}
          {banner.stickers.map((id, i) => {
            const slot = layers.slots[i]
            return slot && slot.side === side ? (
              <Sticker key={`${id}-${i}`} id={id} palette={palette} style={zoneStyle(slot, side, tall)} />
            ) : null
          })}
        </div>
      ))}
      <div
        className={cn(
          "absolute flex flex-col justify-center gap-[0.35em] overflow-hidden",
          layers.align === "center" ? "items-center text-center" : "items-start text-left",
        )}
        style={
          tall
            ? { top: "var(--zone)", bottom: "var(--zone)", left: "8cqw", right: "8cqw" }
            : { left: "var(--zone)", right: "var(--zone)", top: "10cqh", bottom: "10cqh" }
        }
      >
        <p
          className={cn(
            "leading-[1.05] text-balance [overflow-wrap:anywhere]",
            tall ? "line-clamp-3" : "line-clamp-2",
            EVENT_FONT_CLASS[banner.font],
          )}
          style={{ color: palette.text, fontSize: "var(--headline)" }}
        >
          {banner.headline}
        </p>
        {banner.subline ? (
          <p
            className="line-clamp-2 font-sans leading-snug font-semibold [overflow-wrap:anywhere]"
            style={{ color: palette.subText, fontSize: "var(--subline)" }}
          >
            {banner.subline}
          </p>
        ) : null}
      </div>
    </div>
  )
}
