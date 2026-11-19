import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** A shower of hearts. */
export const valentines: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "heart", t: 0.3, u: 0.2, size: 0.8, tone: 0, opacity: 0.9, rotate: -10 },
    { shape: "heart", t: 0.76, u: 0.55, size: 0.4, tone: 1, rotate: 15 },
    { shape: "heart", t: 0.92, u: 0.15, size: 0.28, tone: 0, rotate: -12 },
    { shape: "dots", t: 0.55, u: 0.3, size: 0.3, tone: 1, opacity: 0.5 },
  ],
  slots: DEFAULT_SLOTS,
}
