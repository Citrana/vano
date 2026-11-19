import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** A crescent, stars and a lantern shape (generic geometry). */
export const eid: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "crescent", t: 0.28, u: 0.3, size: 0.7, tone: 0 },
    { shape: "star", t: 0.52, u: 0.68, size: 0.18, tone: 0 },
    { shape: "lantern", t: 0.84, u: 0.3, size: 0.5, tone: 1, opacity: 0.85 },
    { shape: "diamond", t: 0.06, u: 0.62, size: 0.14, tone: 1 },
    { shape: "dots", t: 0.64, u: 0.16, size: 0.22, tone: 0, opacity: 0.4 },
  ],
  slots: DEFAULT_SLOTS,
}
