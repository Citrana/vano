import type { StaticImageData } from "next/image"
import type { ArtworkId } from "../../../convex/lib/looks/banners"
import goldArcs from "@/assets/images/patterns/banners/gold-arcs.svg"
import kitengeDiamonds from "@/assets/images/patterns/banners/kitenge-diamonds.svg"
import kitengeWaves from "@/assets/images/patterns/banners/kitenge-waves.svg"
import petals from "@/assets/images/patterns/banners/petals.svg"
import softDots from "@/assets/images/patterns/banners/soft-dots.svg"

/** Ready-made banner artworks (ids and base colours in convex/lib/looks/banners.ts). */
export const ARTWORK_IMAGES: Record<ArtworkId, StaticImageData> = {
  kitengeDiamonds,
  kitengeWaves,
  petals,
  goldArcs,
  softDots,
}
