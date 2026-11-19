import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Playful circles, diamonds and a wave. */
export const backToSchool: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "circle", t: 0.2, u: 0.12, size: 0.7, tone: 0, opacity: 0.9 },
    { shape: "diamond", t: 0.6, u: 0.55, size: 0.28, tone: 1, rotate: 15 },
    { shape: "wave", t: 0.86, u: 0.4, size: 0.7, tone: 0, rotate: 90 },
    { shape: "star", t: 0.44, u: 0.22, size: 0.2, tone: 1 },
  ],
  slots: DEFAULT_SLOTS,
}
