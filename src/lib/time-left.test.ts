import { describe, expect, test } from "vitest"
import { clockLeft, timeLeft } from "./time-left"

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

describe("live countdown clock", () => {
  test("days, hours, minutes and seconds", () => {
    expect(clockLeft(2 * 1440 * MIN + 4 * 60 * MIN + 10 * MIN + 5_000, 0)).toEqual({
      days: 2,
      hours: 4,
      minutes: 10,
      seconds: 5,
      ended: false,
    })
  })

  test("rounds seconds up and never goes negative", () => {
    expect(clockLeft(59_001, 0)).toEqual({ days: 0, hours: 0, minutes: 1, seconds: 0, ended: false })
    expect(clockLeft(400, 0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1, ended: false })
    expect(clockLeft(0, 0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true })
    expect(clockLeft(0, 5 * MIN)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true })
  })
})
