import { describe, expect, test } from "vitest"
import { EVENT_TEMPLATE_IDS, PROMO_STICKERS_MAX } from "../../../../../convex/lib/looks/events"
import { TEMPLATE_LAYERS } from "./index"

describe("event template layers", () => {
  test("decor and sticker slots stay inside their zone (never over the text)", () => {
    for (const id of EVENT_TEMPLATE_IDS) {
      const layers = TEMPLATE_LAYERS[id]
      expect(layers.slots.length, id).toBeGreaterThanOrEqual(PROMO_STICKERS_MAX)
      for (const item of [...layers.decor, ...layers.slots]) {
        expect(item.u + item.size / 2, `${id} ${JSON.stringify(item)}`).toBeLessThanOrEqual(0.95)
        expect(item.t, id).toBeGreaterThanOrEqual(0)
        expect(item.t, id).toBeLessThanOrEqual(1)
      }
    }
  })
})
