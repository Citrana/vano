import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Dark with light rays and sharp bursts. */
export const blackFriday: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "rays", t: 0.5, u: 0, size: 1.6, tone: 1, opacity: 0.45 },
    { shape: "burst", t: 0.22, u: 0.3, size: 0.6, tone: 0, rotate: -10 },
    { shape: "diamond", t: 0.84, u: 0.5, size: 0.22, tone: 0 },
    { shape: "sparkle", t: 0.62, u: 0.72, size: 0.16, tone: 0 },
  ],
  slots: DEFAULT_SLOTS,
}
