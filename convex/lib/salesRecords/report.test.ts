import { describe, expect, test } from "vitest";
import {
  buildReport,
  change,
  currentMonth,
  daysInMonth,
  isMonth,
  monthRange,
  monthsBetween,
  previousMonth,
  summarize,
  type ReportRecord,
} from "./report";

const sale = (overrides: Partial<ReportRecord> = {}): ReportRecord => ({
  status: "recorded",
  productId: "p1",
  productName: "Robe",
  category: "clothes",
  source: "whatsapp",
  day: "2026-11-10",
  soldAt: Date.UTC(2026, 10, 10, 12),
  quantity: 1,
  total: 2500,
  discount: 0,
  ...overrides,
});

describe("report months", () => {
  test("valid months, ranges and leap years", () => {
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("26-11")).toBe(false);
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(daysInMonth("2026-02")).toBe(28);
  });

  test("the previous month crosses the year; the picker lists newest first", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("2026-11")).toBe("2026-10");
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
    expect(monthsBetween("2026-02", "2026-02")).toEqual(["2026-02"]);
  });

  test("the current month follows the shop's time zone", () => {
    const lateOnOct31 = Date.UTC(2026, 9, 31, 23, 30); // 00:30 on 1 Nov in Kinshasa
    expect(currentMonth(lateOnOct31, "UTC")).toBe("2026-10");
    expect(currentMonth(lateOnOct31, "Africa/Kinshasa")).toBe("2026-11");
    expect(currentMonth(Date.UTC(2026, 10, 1, 2), "America/New_York")).toBe("2026-10");
  });
});

describe("report totals", () => {
  test("only confirmed sales of the month count", () => {
    const report = buildReport(
      [
        sale({ quantity: 2, total: 4000, discount: 1000 }),
        sale({ total: 2500 }),
        sale({ status: "reversed", total: 99_999 }),
        sale({ day: "2026-10-31", total: 77_777 }),
      ],
      "2026-11",
    );
    expect(report.summary).toEqual({ count: 2, items: 3, revenue: 6500, discounts: 1000, average: 3250 });
  });

  test("average is rounded; zero without sales", () => {
    expect(summarize([sale({ total: 1000 }), sale({ total: 1001 }), sale({ total: 1001 })]).average).toBe(1001);
    expect(summarize([]).average).toBe(0);
  });

  test("top 5 by revenue and by pieces, named by the latest snapshot", () => {
    const records = [
      sale({ productId: "a", productName: "Old name", total: 1000, quantity: 5, soldAt: 1 }),
      sale({ productId: "a", productName: "New name", total: 1000, quantity: 5, soldAt: 2 }),
      sale({ productId: "b", productName: "Bag", total: 9000, quantity: 1 }),
      ...["c", "d", "e", "f", "g"].map((id, i) => sale({ productId: id, productName: id, total: 100 * (i + 1), quantity: 1 })),
    ];
    const report = buildReport(records, "2026-11");
    expect(report.topByRevenue.map((p) => p.productId)).toEqual(["b", "a", "g", "f", "e"]);
    expect(report.topByPieces.map((p) => p.productId)).toEqual(["a", "b", "g", "f", "e"]);
    expect(report.topByPieces[0]).toMatchObject({ name: "New name", items: 10, revenue: 2000 });
  });

  test("every day of the month, every source, only categories with sales", () => {
    const report = buildReport(
      [sale({ day: "2026-11-01", source: "instagram" }), sale({ day: "2026-11-30", category: "shoes", quantity: 2, total: 5000 })],
      "2026-11",
    );
    expect(report.byDay).toHaveLength(30);
    expect(report.byDay[0]).toEqual({ day: "2026-11-01", revenue: 2500, sales: 1, items: 1 });
    expect(report.byDay[29]).toEqual({ day: "2026-11-30", revenue: 5000, sales: 1, items: 2 });
    expect(report.bySource.map((s) => s.key)).toEqual(["whatsapp", "instagram", "tiktok", "inPerson", "other"]);
    expect(report.byCategory.map((c) => c.key)).toEqual(["shoes", "clothes"]);
  });
});

describe("change versus the previous month", () => {
  test("up, down, same, and from nothing", () => {
    expect(change(120, 100)).toEqual({ percent: 20, direction: "up" });
    expect(change(80, 100)).toEqual({ percent: 20, direction: "down" });
    expect(change(100, 100)).toEqual({ percent: 0, direction: "same" });
    expect(change(50, 0)).toEqual({ percent: null, direction: "up" });
    expect(change(0, 0)).toEqual({ percent: null, direction: "same" });
    expect(change(0, 40)).toEqual({ percent: 100, direction: "down" });
  });
});
