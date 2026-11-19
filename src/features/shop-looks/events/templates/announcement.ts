import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Calm: one arch and a few dots. */
export const announcement: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "arch", t: 0.5, u: 0.2, size: 0.6, tone: 0, opacity: 0.8, rotate: 90 },
    { shape: "dots", t: 0.14, u: 0.5, size: 0.28, tone: 0, opacity: 0.6 },
  ],
  slots: DEFAULT_SLOTS,
}
