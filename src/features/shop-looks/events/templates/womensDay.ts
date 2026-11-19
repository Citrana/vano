import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Bold blobs, a flower and a star: confident and bright. */
export const womensDay: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "blob2", t: 0.26, u: 0.05, size: 1, tone: 0, opacity: 0.9 },
    { shape: "blob", t: 0.82, u: 0.25, size: 0.6, tone: 1, opacity: 0.85 },
    { shape: "star", t: 0.56, u: 0.75, size: 0.22, tone: 1 },
    { shape: "flower", t: 0.05, u: 0.62, size: 0.3, tone: 1 },
  ],
  slots: DEFAULT_SLOTS,
}
