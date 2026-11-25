import { describe, expect, test } from "vitest"
import { datePresets } from "./date-presets"

const NOW = Date.UTC(2026, 10, 30, 23, 30) // 00:30 on 1 Dec in Kinshasa

describe("date filter presets", () => {
  test("UTC by default (admin lists)", () => {
    const { today, presets } = datePresets(NOW)
    expect(today).toBe("2026-11-30")
    expect(presets).toEqual([
      { key: "last7", from: "2026-11-24", to: "2026-11-30" },
      { key: "last30", from: "2026-11-01", to: "2026-11-30" },
      { key: "thisMonth", from: "2026-11-01", to: "2026-11-30" },
    ])
  })

  test("in the shop's time zone (recorded sales)", () => {
    const { today, presets } = datePresets(NOW, "Africa/Kinshasa")
    expect(today).toBe("2026-12-01")
    expect(presets.find((p) => p.key === "thisMonth")).toEqual({ key: "thisMonth", from: "2026-12-01", to: "2026-12-01" })
  })
})
