import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** A big blob, a ring and a sparkle. */
export const announcementBold: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "blob", t: 0.22, u: 0.05, size: 1, tone: 0, opacity: 0.9 },
    { shape: "ring", t: 0.76, u: 0.35, size: 0.5, tone: 1 },
    { shape: "sparkle", t: 0.52, u: 0.72, size: 0.22, tone: 1 },
  ],
  slots: DEFAULT_SLOTS,
}
