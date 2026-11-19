import { DEFAULT_SLOTS, type TemplateLayers } from "./types"

/** Snowflakes, a garland and baubles of light. */
export const christmas: TemplateLayers = {
  align: "center",
  decor: [
    { shape: "garland", t: 0.12, u: 0.3, size: 0.6, tone: 1, opacity: 0.8 },
    { shape: "snowflake", t: 0.32, u: 0.35, size: 0.5, tone: 1, opacity: 0.75 },
    { shape: "snowflake", t: 0.78, u: 0.62, size: 0.28, tone: 1, opacity: 0.55 },
    { shape: "circle", t: 0.95, u: 0.12, size: 0.6, tone: 0, opacity: 0.9 },
    { shape: "dots", t: 0.55, u: 0.18, size: 0.32, tone: 1, opacity: 0.5 },
  ],
  slots: DEFAULT_SLOTS,
}
