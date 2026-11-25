import { describe, expect, test } from "vitest";
import { DEFAULT_TIME_ZONE, localDay, shopTimeZone, timeZoneProblem, zonedToUtc } from "./timeZone";

describe("time zones", () => {
  test("valid and invalid zones", () => {
    expect(timeZoneProblem("Africa/Kinshasa")).toBeNull();
    expect(timeZoneProblem("UTC")).toBeNull();
    expect(timeZoneProblem("Mars/Olympus")).toBe("invalid");
    expect(timeZoneProblem("")).toBe("invalid");
  });

  test("a shop without a (valid) zone uses UTC", () => {
    expect(shopTimeZone({})).toBe(DEFAULT_TIME_ZONE);
    expect(shopTimeZone({ timeZone: "nope" })).toBe(DEFAULT_TIME_ZONE);
    expect(shopTimeZone({ timeZone: "Africa/Nairobi" })).toBe("Africa/Nairobi");
  });

  test("the local day around midnight depends on the zone", () => {
    const lateUtc = Date.UTC(2026, 10, 26, 23, 30); // 23:30 UTC
    expect(localDay(lateUtc, "UTC")).toBe("2026-11-26");
    expect(localDay(lateUtc, "Africa/Kinshasa")).toBe("2026-11-27"); // 00:30 UTC+1
    expect(localDay(Date.UTC(2026, 10, 27, 0, 30), "America/New_York")).toBe("2026-11-26");
  });

  test("wall clock → UTC across a DST change", () => {
    expect(zonedToUtc({ year: 2026, month: 1, day: 15, hour: 10, minute: 0 }, "Europe/Paris")).toBe(Date.UTC(2026, 0, 15, 9));
    expect(zonedToUtc({ year: 2026, month: 7, day: 15, hour: 10, minute: 0 }, "Europe/Paris")).toBe(Date.UTC(2026, 6, 15, 8));
    expect(localDay(zonedToUtc({ year: 2026, month: 3, day: 29, hour: 0, minute: 30 }, "Europe/Paris"), "Europe/Paris")).toBe("2026-03-29");
  });
});
