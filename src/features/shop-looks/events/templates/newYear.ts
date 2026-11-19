import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Sparkles, confetti and a ring: a night out. */
export const newYear: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "sparkle", t: 0.26, u: 0.3, size: 0.56, tone: 0 },
    { shape: "sparkle", t: 0.64, u: 0.66, size: 0.26, tone: 1 },
    { shape: "confetti", t: 0.84, u: 0.3, size: 0.5, tone: 0, opacity: 0.9 },
    { shape: "ring", t: 0.04, u: 0.5, size: 0.4, tone: 1, opacity: 0.8 },
    { shape: "dots", t: 0.46, u: 0.14, size: 0.24, tone: 1, opacity: 0.7 },
  ],
  slots: DEFAULT_SLOTS,
}
