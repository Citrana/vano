import { describe, expect, test } from "vitest"
import { codeStatusAt } from "../../convex/lib/discountCodes/active"
import { fromLocalInput, toLocalInput } from "./local-time"

describe("local date-time fields (seller's time zone ↔ UTC)", () => {
  test("the same wall-clock time is a different instant in each time zone", () => {
    expect(fromLocalInput("2026-11-27T00:00", "Africa/Kinshasa")).toBe(Date.UTC(2026, 10, 26, 23, 0)) // UTC+1
    expect(fromLocalInput("2026-11-27T00:00", "Africa/Lubumbashi")).toBe(Date.UTC(2026, 10, 26, 22, 0)) // UTC+2
    expect(fromLocalInput("2026-11-27T00:00", "Africa/Nairobi")).toBe(Date.UTC(2026, 10, 26, 21, 0)) // UTC+3
  })

  test("round trip, including across a daylight saving change", () => {
    for (const zone of ["Africa/Kinshasa", "Africa/Nairobi", "Europe/Paris", "America/New_York"]) {
      for (const value of ["2026-03-28T23:30", "2026-03-29T12:00", "2026-10-25T12:00", "2026-11-19T08:15"]) {
        expect(toLocalInput(fromLocalInput(value, zone), zone), `${zone} ${value}`).toBe(value)
      }
    }
    // Paris: UTC+1 in winter, UTC+2 in summer.
    expect(fromLocalInput("2026-01-15T10:00", "Europe/Paris")).toBe(Date.UTC(2026, 0, 15, 9, 0))
    expect(fromLocalInput("2026-07-15T10:00", "Europe/Paris")).toBe(Date.UTC(2026, 6, 15, 8, 0))
  })

  test("empty or malformed input", () => {
    expect(fromLocalInput("")).toBeUndefined()
    expect(fromLocalInput("27/11/2026", "Africa/Kinshasa")).toBeUndefined()
    expect(toLocalInput(undefined)).toBe("")
  })

  test("a discount code ends at the seller's local midnight, whatever the visitor's zone", () => {
    // Entered in Kinshasa (UTC+1): ends at 23:00 UTC the day before.
    const endsAt = fromLocalInput("2026-11-27T00:00", "Africa/Kinshasa")!
    const code = { startsAt: Date.UTC(2026, 10, 20), endsAt, paused: false, uses: 0 }
    expect(codeStatusAt(code, Date.UTC(2026, 10, 26, 22, 59))).toBe("running")
    expect(codeStatusAt(code, Date.UTC(2026, 10, 26, 23, 0))).toBe("ended")
    // The same wall-clock end in Nairobi (UTC+3) is two hours earlier.
    const nairobi = { ...code, endsAt: fromLocalInput("2026-11-27T00:00", "Africa/Nairobi")! }
    expect(codeStatusAt(nairobi, Date.UTC(2026, 10, 26, 21, 0))).toBe("ended")
    expect(codeStatusAt(code, Date.UTC(2026, 10, 26, 21, 0))).toBe("running")
  })
})
