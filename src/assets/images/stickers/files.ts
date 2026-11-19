import type { StaticImageData } from "next/image"
import percentBurst from "./percent-burst.svg"
import saleTag from "./sale-tag.svg"
import shoppingBag from "./shopping-bag.svg"
import star from "./star.svg"
import sparkles from "./sparkles.svg"
import diamond from "./diamond.svg"
import crown from "./crown.svg"
import heart from "./heart.svg"
import heartOutline from "./heart-outline.svg"
import bow from "./bow.svg"
import flower from "./flower.svg"
import tulip from "./tulip.svg"
import leaves from "./leaves.svg"
import sun from "./sun.svg"
import crescent from "./crescent.svg"
import lantern from "./lantern.svg"
import ornament from "./ornament.svg"
import snowflake from "./snowflake.svg"
import gift from "./gift.svg"
import confetti from "./confetti.svg"
import balloon from "./balloon.svg"
import pencil from "./pencil.svg"
import type { StickerId } from "./manifest"

/**
 * The sticker files, by id (see README.md). Typed by the manifest: a
 * sticker listed there without a file here fails the typecheck.
 */
export const STICKER_FILES: Record<StickerId, StaticImageData> = {
  percentBurst,
  saleTag,
  shoppingBag,
  star,
  sparkles,
  diamond,
  crown,
  heart,
  heartOutline,
  bow,
  flower,
  tulip,
  leaves,
  sun,
  crescent,
  lantern,
  ornament,
  snowflake,
  gift,
  confetti,
  balloon,
  pencil,
}
