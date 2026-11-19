import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Ribbon waves and a round tag. */
export const restocked: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "wave", t: 0.18, u: 0.35, size: 0.9, tone: 0, rotate: 90 },
    { shape: "wave", t: 0.3, u: 0.55, size: 0.7, tone: 1, rotate: 90 },
    { shape: "circle", t: 0.82, u: 0.12, size: 0.7, tone: 0, opacity: 0.8 },
    { shape: "dots", t: 0.55, u: 0.2, size: 0.3, tone: 1, opacity: 0.7 },
  ],
  slots: DEFAULT_SLOTS,
}
