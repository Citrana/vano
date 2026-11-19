import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Soft arch and blob with a little shine. */
export const newArrivals: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "blob", t: 0.22, u: 0.1, size: 0.9, tone: 0, opacity: 0.85 },
    { shape: "arch", t: 0.86, u: 0.2, size: 0.7, tone: 1, opacity: 0.9 },
    { shape: "dots", t: 0.52, u: 0.5, size: 0.4, tone: 0, opacity: 0.6 },
    { shape: "sparkle", t: 0.62, u: 0.78, size: 0.18, tone: 0 },
  ],
  slots: DEFAULT_SLOTS,
}
