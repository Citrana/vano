import { describe, expect, test } from "vitest"
import { timeLeft } from "./time-left"

const MIN = 60_000

describe("sale countdown", () => {
  test("days, hours and minutes", () => {
    expect(timeLeft(2 * 1440 * MIN + 4 * 60 * MIN + 10 * MIN, 0)).toEqual({ days: 2, hours: 4, minutes: 10, ended: false })
  })

  test("rounds minutes up and never goes negative", () => {
    expect(timeLeft(30_000, 0)).toEqual({ days: 0, hours: 0, minutes: 1, ended: false })
    expect(timeLeft(0, 0)).toEqual({ days: 0, hours: 0, minutes: 0, ended: true })
    expect(timeLeft(0, 5 * MIN)).toEqual({ days: 0, hours: 0, minutes: 0, ended: true })
  })
})
