import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Big burst, confetti and dots: loud and happy. */
export const sale: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "burst", t: 0.3, u: 0.15, size: 1, tone: 0, opacity: 0.9, rotate: 8 },
    { shape: "circle", t: 0.88, u: 0.2, size: 0.5, tone: 1, opacity: 0.7 },
    { shape: "confetti", t: 0.6, u: 0.6, size: 0.42, tone: 1 },
    { shape: "sparkle", t: 0.06, u: 0.7, size: 0.22, tone: 1 },
  ],
  slots: DEFAULT_SLOTS,
}
