import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Big soft flowers and an arch. */
export const mothersDay: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "flower", t: 0.26, u: 0.18, size: 0.8, tone: 0, opacity: 0.9 },
    { shape: "flower", t: 0.72, u: 0.56, size: 0.4, tone: 1, rotate: 20 },
    { shape: "arch", t: 0.96, u: 0.18, size: 0.6, tone: 0, opacity: 0.6 },
    { shape: "dots", t: 0.5, u: 0.2, size: 0.26, tone: 1, opacity: 0.6 },
  ],
  slots: DEFAULT_SLOTS,
}
