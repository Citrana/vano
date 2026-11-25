import type { Category } from "../catalog";
import { localDay } from "../timeZone";
import { sumRecords, type RecordTotals } from "./pricing";
import { SALE_SOURCES, type SaleSource } from "./validators";

/**
 * Monthly reports (CLAUDE.md "Sales tracking"), pure. A month is
 * "YYYY-MM" in the shop's time zone: each sale already stores its local
 * `day`, so a month is just a day range. Only confirmed sales count
 * (reversed ones never), and only from the sale's own snapshot, so later
 * edits or deletions of a product don't change past reports.
 */

/** Most sales a report reads for one month (beyond: `truncated`). */
export const REPORT_MAX = 5000;
export const TOP_PRODUCTS = 5;

const pad = (n: number) => String(n).padStart(2, "0");

export function isMonth(value: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m !== null && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** "2026-11-19" → "2026-11". */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** How many days the month has (February in leap years included). */
export function daysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** The month's first and last day ("YYYY-MM-DD", both included). */
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${month}-${pad(daysInMonth(month))}` };
}

export function previousMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 1 ? `${year - 1}-12` : `${year}-${pad(m - 1)}`;
}

/** The current month in a time zone (the client passes it; queries don't read the clock). */
export function currentMonth(now: number, timeZone: string): string {
  return monthOf(localDay(now, timeZone));
}

/** Every month from `first` to `last`, newest first (the month picker). */
export function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  for (let m = last; m >= first && out.length < 240; m = previousMonth(m)) out.push(m);
  return out;
}

/** What a report needs from each sale (its snapshot). */
export type ReportRecord = {
  status: "recorded" | "reversed";
  productId: string;
  productName: string;
  photoId?: string;
  category: Category;
  source: SaleSource;
  day: string;
  soldAt: number;
  quantity: number;
  total: number;
  discount: number;
};

export type ReportSummary = RecordTotals & { average: number };
export type TopProduct = { productId: string; name: string; photoId: string | null; revenue: number; items: number };
export type DayBar = { day: string; revenue: number; sales: number; items: number };
export type GroupRow<K extends string> = { key: K; revenue: number; sales: number; items: number };

export type Report = {
  summary: ReportSummary;
  topByRevenue: TopProduct[];
  topByPieces: TopProduct[];
  byDay: DayBar[];
  bySource: GroupRow<SaleSource>[];
  byCategory: GroupRow<Category>[];
};

/** Totals plus the average sale (rounded to a whole minor unit; 0 without sales). */
export function summarize(records: readonly ReportRecord[]): ReportSummary {
  const totals = sumRecords(records);
  return { ...totals, average: totals.count === 0 ? 0 : Math.round(totals.revenue / totals.count) };
}

/** The month's report from its sales (any order; reversed ones and other months are left out). */
export function buildReport(records: readonly ReportRecord[], month: string): Report {
  const counted = records.filter((r) => r.status === "recorded" && monthOf(r.day) === month);

  const products = new Map<string, TopProduct & { latest: number }>();
  for (const r of counted) {
    const p = products.get(r.productId) ?? { productId: r.productId, name: r.productName, photoId: r.photoId ?? null, revenue: 0, items: 0, latest: -1 };
    p.revenue += r.total;
    p.items += r.quantity;
    // The latest sale's snapshot names the product (it may have been renamed).
    if (r.soldAt > p.latest) {
      p.latest = r.soldAt;
      p.name = r.productName;
      p.photoId = r.photoId ?? null;
    }
    products.set(r.productId, p);
  }
  const all: TopProduct[] = [...products.values()].map((p) => ({
    productId: p.productId,
    name: p.name,
    photoId: p.photoId,
    revenue: p.revenue,
    items: p.items,
  }));
  const byName = (a: TopProduct, b: TopProduct) => a.name.localeCompare(b.name);
  const topByRevenue = [...all].sort((a, b) => b.revenue - a.revenue || b.items - a.items || byName(a, b)).slice(0, TOP_PRODUCTS);
  const topByPieces = [...all].sort((a, b) => b.items - a.items || b.revenue - a.revenue || byName(a, b)).slice(0, TOP_PRODUCTS);

  const { from } = monthRange(month);
  const byDay: DayBar[] = Array.from({ length: daysInMonth(month) }, (_, i) => ({
    day: `${from.slice(0, 8)}${pad(i + 1)}`,
    revenue: 0,
    sales: 0,
    items: 0,
  }));
  for (const r of counted) {
    const bar = byDay[Number(r.day.slice(8, 10)) - 1];
    if (!bar) continue;
    bar.revenue += r.total;
    bar.sales += 1;
    bar.items += r.quantity;
  }

  return {
    summary: summarize(counted),
    topByRevenue,
    topByPieces,
    byDay,
    bySource: group(counted, (r) => r.source, SALE_SOURCES),
    byCategory: group(counted, (r) => r.category).filter((g) => g.sales > 0),
  };
}

/** Totals per key, biggest revenue first; `keys` lists every key to show, zeros included. */
function group<K extends string>(records: readonly ReportRecord[], keyOf: (r: ReportRecord) => K, keys: readonly K[] = []): GroupRow<K>[] {
  const rows = new Map<K, GroupRow<K>>(keys.map((key) => [key, { key, revenue: 0, sales: 0, items: 0 }]));
  for (const r of records) {
    const key = keyOf(r);
    const row = rows.get(key) ?? { key, revenue: 0, sales: 0, items: 0 };
    row.revenue += r.total;
    row.sales += 1;
    row.items += r.quantity;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue || b.sales - a.sales);
}

export type Change = { percent: number | null; direction: "up" | "down" | "same" };

/** The change versus the previous month (whole percent; null when there was nothing before). */
export function change(current: number, previous: number): Change {
  if (current === previous) return { percent: current === 0 ? null : 0, direction: "same" };
  const direction = current > previous ? "up" : "down";
  if (previous === 0) return { percent: null, direction };
  return { percent: Math.round((Math.abs(current - previous) * 100) / previous), direction };
}

/** The change of every summary number. */
export function summaryChanges(current: ReportSummary, previous: ReportSummary) {
  return {
    revenue: change(current.revenue, previous.revenue),
    items: change(current.items, previous.items),
    count: change(current.count, previous.count),
    average: change(current.average, previous.average),
    discounts: change(current.discounts, previous.discounts),
  };
}
