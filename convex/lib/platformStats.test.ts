import { describe, expect, test } from "vitest";
import { readPlatformStats } from "./platformStats";
import { newTest } from "./test.utils";

describe("readPlatformStats", () => {
  test("is all zeros on an empty deployment", async () => {
    const t = newTest();
    expect(await t.run((ctx) => readPlatformStats(ctx, "2026-11-17"))).toEqual({
      totals: { users: 0, shops: 0, products: 0, whatsappClicks: 0 },
      last7: { signups: 0, shops: 0 },
      last30: { signups: 0, shops: 0 },
    });
  });
});
