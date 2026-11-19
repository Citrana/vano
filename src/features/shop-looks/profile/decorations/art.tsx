import type { ReactNode } from "react"
import type { ProfileDecorationId } from "../../../../../convex/lib/looks/profile"
import { SHAPES } from "../../events/shapes"

/**
 * Profile decorations (CLAUDE.md "Shop looks" → "Profile"): original,
 * light inline SVG, no characters or logos. Each one draws in its own box
 * (`viewBox`), placed and sized by `decorationBox` (profile.ts). Every
 * shape gets a thin outline in the page background (`halo`), so it stays
 * crisp on a photo or a banner. Curated colours, never the seller's.
 */

export type ProfileBadgeLabels = { queen: string; bossLady: string; new: string; sale: string }

type ArtProps = { halo: string; labels: ProfileBadgeLabels }

type Art = {
  /** Local drawing box. Ring decorations draw in photo-box units directly. */
  viewBox: string
  draw: (props: ArtProps) => ReactNode
}

const GOLD = "#e8b13a"
const GOLD_DARK = "#9a6a08"
const PINK = "#e8467c"
const PINK_SOFT = "#f59ab8"
const LILAC = "#b79be8"
const PEACH = "#f6b37f"
const LEAF = "#4f7a52"
const INK = "#1a1412"
const CREAM = "#fff8f3"
const RED = "#d23a3a"

/** A path with a halo outline behind it. */
function P({ d, fill, halo, outline = 6, stroke, strokeWidth }: { d: string; fill: string; halo: string; outline?: number; stroke?: string; strokeWidth?: number }) {
  return (
    <>
      <path d={d} fill={halo} stroke={halo} strokeWidth={outline} strokeLinejoin="round" />
      <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </>
  )
}

/** One of the 100×100 event shapes, placed at x,y with a size. */
function S({ shape, x, y, size, fill, halo, rotate = 0 }: { shape: keyof typeof SHAPES; x: number; y: number; size: number; fill: string; halo: string; rotate?: number }) {
  const k = size / 100
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} ${size / 2} ${size / 2}) scale(${k})`}>
      <P d={SHAPES[shape].d} fill={fill} halo={halo} outline={6 / k} />
    </g>
  )
}

/** A small five-petal flower with a centre. */
function Flower({ x, y, size, fill, halo }: { x: number; y: number; size: number; fill: string; halo: string }) {
  return (
    <>
      <S shape="flower" x={x} y={y} size={size} fill={fill} halo={halo} />
      <circle cx={x + size / 2} cy={y + size / 2} r={size * 0.13} fill={GOLD} />
    </>
  )
}

/** A ribbon banner with a short label (shop language). */
function Ribbon({ label, fill, text, halo }: { label: string; fill: string; text: string; halo: string }) {
  const long = label.length > 9
  return (
    <>
      <P d="M0 9H16V31H0L6 20Z" fill={fill} halo={halo} />
      <P d="M100 9H84V31H100L94 20Z" fill={fill} halo={halo} />
      <P d="M10 4H90V28H10Z" fill={fill} halo={halo} />
      <text
        x="50"
        y="16.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="14"
        fontWeight="800"
        fill={text}
        className="font-heading"
        textLength={long ? 74 : undefined}
        lengthAdjust={long ? "spacingAndGlyphs" : undefined}
      >
        {label}
      </text>
    </>
  )
}

/** A round sticker with a short label. */
function Sticker({ label, fill, text, halo }: { label: string; fill: string; text: string; halo: string }) {
  const long = label.length > 5
  return (
    <>
      <S shape="burst" x={4} y={4} size={92} fill={fill} halo={halo} />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={long ? 17 : 21}
        fontWeight="800"
        fill={text}
        className="font-heading"
        textLength={label.length > 7 ? 70 : undefined}
        lengthAdjust={label.length > 7 ? "spacingAndGlyphs" : undefined}
      >
        {label}
      </text>
    </>
  )
}

function Butterfly({ x, y, size, wing, halo }: { x: number; y: number; size: number; wing: string; halo: string }) {
  const k = size / 100
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <P d="M50 50C30 10 2 14 6 38C8 54 30 58 50 50Z" fill={wing} halo={halo} outline={6 / k} />
      <P d="M50 50C70 10 98 14 94 38C92 54 70 58 50 50Z" fill={wing} halo={halo} outline={6 / k} />
      <P d="M50 52C34 66 22 88 38 90C46 90 50 72 50 52Z" fill={wing} halo={halo} outline={6 / k} />
      <P d="M50 52C66 66 78 88 62 90C54 90 50 72 50 52Z" fill={wing} halo={halo} outline={6 / k} />
      <path d="M50 30V82" stroke={INK} strokeWidth={6} strokeLinecap="round" />
    </g>
  )
}

export const PROFILE_DECORATION_ART: Record<ProfileDecorationId, Art> = {
  goldCrown: {
    viewBox: "0 0 100 62",
    draw: ({ halo }) => (
      <>
        <P d="M10 54L5 16L29 34L50 6L71 34L95 16L90 54Z" fill={GOLD} halo={halo} stroke={GOLD_DARK} strokeWidth={2.5} />
        <P d="M10 50H90V60H10Z" fill={GOLD_DARK} halo={halo} />
        <circle cx="50" cy="6" r="5" fill={PINK} />
        <circle cx="5" cy="16" r="4" fill={CREAM} />
        <circle cx="95" cy="16" r="4" fill={CREAM} />
        <circle cx="50" cy="38" r="5" fill={CREAM} />
      </>
    ),
  },
  tiara: {
    viewBox: "0 0 100 50",
    draw: ({ halo }) => (
      <>
        <P d="M6 44Q50 18 94 44L90 49Q50 27 10 49Z" fill="#c9ced6" halo={halo} />
        <P d="M50 2L58 30H42Z" fill="#dfe3e8" halo={halo} />
        <P d="M27 13L34 35L21 37Z" fill="#dfe3e8" halo={halo} />
        <P d="M73 13L79 37L66 35Z" fill="#dfe3e8" halo={halo} />
        <circle cx="50" cy="30" r="5.5" fill={PINK} stroke={halo} strokeWidth={2} />
        <circle cx="28" cy="35" r="3" fill={LILAC} />
        <circle cx="72" cy="35" r="3" fill={LILAC} />
      </>
    ),
  },
  flowerCrown: {
    viewBox: "0 0 100 42",
    draw: ({ halo }) => (
      <>
        <path d="M4 34Q50 8 96 34" fill="none" stroke={halo} strokeWidth={9} strokeLinecap="round" />
        <path d="M4 34Q50 8 96 34" fill="none" stroke={LEAF} strokeWidth={4.5} strokeLinecap="round" />
        <Flower x={2} y={18} size={22} fill={PINK_SOFT} halo={halo} />
        <Flower x={22} y={8} size={22} fill={PEACH} halo={halo} />
        <Flower x={39} y={2} size={22} fill={LILAC} halo={halo} />
        <Flower x={56} y={8} size={22} fill={PINK_SOFT} halo={halo} />
        <Flower x={76} y={18} size={22} fill={PEACH} halo={halo} />
      </>
    ),
  },
  queen: {
    viewBox: "0 0 100 34",
    draw: ({ halo, labels }) => <Ribbon label={labels.queen} fill="#7a2e5c" text={CREAM} halo={halo} />,
  },
  bossLady: {
    viewBox: "0 0 100 34",
    draw: ({ halo, labels }) => <Ribbon label={labels.bossLady} fill={INK} text="#f2c45a" halo={halo} />,
  },
  santaHat: {
    viewBox: "0 0 100 80",
    draw: ({ halo }) => (
      <>
        <P d="M12 66Q26 12 74 12Q94 14 88 36Q70 28 62 66Z" fill={RED} halo={halo} />
        <P d="M4 60H70A9 9 0 0 1 70 78H4A9 9 0 0 1 4 60Z" fill={CREAM} halo={halo} />
        <circle cx="88" cy="36" r="10" fill={CREAM} stroke={halo} strokeWidth={3} />
      </>
    ),
  },
  hearts: {
    viewBox: "0 0 100 100",
    draw: ({ halo }) => (
      <>
        <S shape="heart" x={14} y={24} size={54} fill={PINK} halo={halo} rotate={-12} />
        <S shape="heart" x={64} y={4} size={28} fill={PINK_SOFT} halo={halo} rotate={14} />
        <S shape="heart" x={70} y={66} size={20} fill={PINK_SOFT} halo={halo} rotate={-8} />
      </>
    ),
  },
  crescentStars: {
    viewBox: "0 0 100 100",
    draw: ({ halo }) => (
      <>
        <S shape="crescent" x={10} y={18} size={62} fill={GOLD} halo={halo} />
        <S shape="star" x={66} y={6} size={24} fill={GOLD} halo={halo} />
        <S shape="star" x={72} y={60} size={16} fill="#f2c45a" halo={halo} />
        <S shape="sparkle" x={50} y={76} size={14} fill="#f2c45a" halo={halo} />
      </>
    ),
  },
  eventFlowers: {
    viewBox: "0 0 100 100",
    draw: ({ halo }) => (
      <>
        <P d="M40 70C30 86 50 96 62 84C58 76 50 72 40 70Z" fill={LEAF} halo={halo} />
        <Flower x={8} y={14} size={56} fill={PINK_SOFT} halo={halo} />
        <Flower x={58} y={50} size={36} fill={LILAC} halo={halo} />
        <Flower x={64} y={6} size={22} fill={PEACH} halo={halo} />
      </>
    ),
  },
  newYearSparkles: {
    viewBox: "0 0 100 100",
    draw: ({ halo }) => (
      <>
        <S shape="sparkle" x={18} y={20} size={52} fill={GOLD} halo={halo} />
        <S shape="sparkle" x={68} y={6} size={22} fill="#f2c45a" halo={halo} />
        <S shape="star" x={70} y={60} size={18} fill={LILAC} halo={halo} />
        <circle cx="16" cy="84" r="4" fill={PINK} stroke={halo} strokeWidth={2} />
        <circle cx="58" cy="88" r="3.5" fill={LILAC} stroke={halo} strokeWidth={2} />
        <P d="M84 40L92 36L94 44L86 48Z" fill={PINK} halo={halo} outline={3} />
        <P d="M4 44L12 42L12 50L4 52Z" fill={GOLD} halo={halo} outline={3} />
      </>
    ),
  },
  saleTag: {
    viewBox: "0 0 100 100",
    draw: ({ halo }) => (
      <>
        <P d="M10 40L40 10H86A4 4 0 0 1 90 14V60L60 90A6 6 0 0 1 52 90L10 48A6 6 0 0 1 10 40Z" fill={INK} halo={halo} />
        <circle cx="74" cy="26" r="6" fill={halo} />
        <text x="50" y="55" textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="800" fill={CREAM} className="font-heading">
          %
        </text>
      </>
    ),
  },
  pencil: {
    viewBox: "0 0 100 100",
    draw: ({ halo }) => (
      <g transform="rotate(-45 50 50)">
        <P d="M14 40H74V60H14Z" fill="#f2c33a" halo={halo} />
        <P d="M74 40L94 50L74 60Z" fill="#f3d7b0" halo={halo} />
        <path d="M88 47L94 50L88 53Z" fill={INK} />
        <P d="M4 40H14V60H4A4 4 0 0 1 0 56V44A4 4 0 0 1 4 40Z" fill={PINK_SOFT} halo={halo} />
        <path d="M14 47H74" stroke="#d9a51e" strokeWidth={2} />
        <path d="M14 53H74" stroke="#d9a51e" strokeWidth={2} />
      </g>
    ),
  },
  backpack: {
    viewBox: "0 0 100 100",
    draw: ({ halo }) => (
      <>
        <path d="M36 22V14A14 14 0 0 1 64 14V22" fill="none" stroke={halo} strokeWidth={10} />
        <path d="M36 22V14A14 14 0 0 1 64 14V22" fill="none" stroke="#2c52a8" strokeWidth={5} />
        <P d="M22 34A16 16 0 0 1 38 18H62A16 16 0 0 1 78 34V86A8 8 0 0 1 70 94H30A8 8 0 0 1 22 86Z" fill="#3f6fd8" halo={halo} />
        <P d="M32 60H68V82A4 4 0 0 1 64 86H36A4 4 0 0 1 32 82Z" fill="#2c52a8" halo={halo} outline={3} />
        <path d="M44 68H56" stroke="#f2c33a" strokeWidth={4} strokeLinecap="round" />
      </>
    ),
  },
  spookyHat: {
    viewBox: "0 0 100 80",
    draw: ({ halo }) => (
      <>
        <P d="M26 64L48 6Q56 2 60 12L60 30L72 64Z" fill="#3b2a55" halo={halo} />
        <P d="M30 52H70L72 62H28Z" fill="#f08a24" halo={halo} outline={3} />
        <P d="M2 70Q50 56 98 70Q50 82 2 70Z" fill="#2a1d3e" halo={halo} />
        <S shape="star" x={44} y={30} size={14} fill="#f2c45a" halo={halo} />
      </>
    ),
  },
  sparkles: {
    viewBox: "0 0 100 100",
    draw: ({ halo }) => (
      <>
        <S shape="sparkle" x={14} y={26} size={56} fill={GOLD} halo={halo} />
        <S shape="sparkle" x={66} y={8} size={26} fill="#f2c45a" halo={halo} />
        <S shape="sparkle" x={68} y={66} size={18} fill="#f2c45a" halo={halo} />
      </>
    ),
  },
  bow: {
    viewBox: "0 0 100 72",
    draw: ({ halo }) => (
      <>
        <P d="M44 40L30 70L40 68L46 72L50 44Z" fill="#c72f66" halo={halo} />
        <P d="M56 40L70 70L60 68L54 72L50 44Z" fill="#c72f66" halo={halo} />
        <P d="M50 34C32 4 4 10 6 30C4 52 32 58 50 34Z" fill={PINK} halo={halo} />
        <P d="M50 34C68 4 96 10 94 30C96 52 68 58 50 34Z" fill={PINK} halo={halo} />
        <P d="M42 26H58A4 4 0 0 1 62 30V40A4 4 0 0 1 58 44H42A4 4 0 0 1 38 40V30A4 4 0 0 1 42 26Z" fill="#c72f66" halo={halo} outline={3} />
      </>
    ),
  },
  butterflies: {
    viewBox: "0 0 100 100",
    draw: ({ halo }) => (
      <>
        <Butterfly x={0} y={18} size={72} wing={LILAC} halo={halo} />
        <Butterfly x={60} y={0} size={40} wing={PEACH} halo={halo} />
      </>
    ),
  },
  floralWreath: {
    // Drawn in photo-box units, along the lower edge (radius 46 ± 6: outside the face zone).
    viewBox: "-8 -8 116 116",
    draw: ({ halo }) => {
      const r = 50
      const leaves = Array.from({ length: 11 }, (_, i) => 22 + i * 13.6)
      const flowers = [48, 90, 132]
      const at = (deg: number) => [50 + r * Math.cos((deg * Math.PI) / 180), 50 + r * Math.sin((deg * Math.PI) / 180)] as const
      return (
        <>
          {leaves.map((deg) => {
            const [x, y] = at(deg)
            return (
              <g key={deg} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg + 90})`}>
                <ellipse rx="6.5" ry="3.2" fill={halo} stroke={halo} strokeWidth={2.5} />
                <ellipse rx="6" ry="2.8" fill={LEAF} />
              </g>
            )
          })}
          {flowers.map((deg, i) => {
            const [x, y] = at(deg)
            return <Flower key={deg} x={x - 6} y={y - 6} size={12} fill={[PINK_SOFT, PEACH, LILAC][i]} halo={halo} />
          })}
        </>
      )
    },
  },
  newSticker: {
    viewBox: "0 0 100 100",
    draw: ({ halo, labels }) => <Sticker label={labels.new} fill="#0f5e46" text={CREAM} halo={halo} />,
  },
  saleSticker: {
    viewBox: "0 0 100 100",
    draw: ({ halo, labels }) => <Sticker label={labels.sale} fill={RED} text={CREAM} halo={halo} />,
  },
}
