import { describe, expect, test } from "vitest";
import { roundPrice } from "../money";
import { affectedProducts, bestSaleFor, overlappingSales, saleLiveAt, saleStatusAt, type SaleLike } from "./active";
import { discountedPrice, discountProblem, isSteep, percentOff } from "./discount";
import { blackFridayOf, presetValues, saleScheduleProblem, SALE_PRESETS } from "./rules";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 19, 12, 0); // 19 Nov 2026, 12:00 UTC

const display = { countdown: true, badge: true, label: false };
function sale(overrides: Partial<SaleLike> = {}): SaleLike {
  return {
    _id: "s1",
    name: "Sale",
    discount: { kind: "percent", value: 30 },
    target: { kind: "shop", excludedIds: [] },
    startsAt: NOW - HOUR,
    endsAt: NOW + DAY,
    paused: false,
    display,
    ...overrides,
  };
}
const dress = { _id: "p1", price: 2500, category: "clothes" as const };
const shoes = { _id: "p2", price: 10_000, category: "shoes" as const };

describe("discountedPrice", () => {
  test("percent off, rounded to the cent in USD / EUR", () => {
    expect(discountedPrice(2500, { kind: "percent", value: 30 }, "USD")).toBe(1750);
    expect(discountedPrice(999, { kind: "percent", value: 15 }, "EUR")).toBe(849); // 8.4915 → 8.49
  });

  test("percent off, rounded to whole shillings (KES) and 100 FC (CDF)", () => {
    expect(discountedPrice(129_900, { kind: "percent", value: 25 }, "KES")).toBe(97_400); // 974.25 → 974
    expect(discountedPrice(2_500_000, { kind: "percent", value: 33 }, "CDF")).toBe(1_680_000); // 16 750 → 16 800
  });

  test("a cheap item is rounded more finely, never into a bigger discount", () => {
    // 150 FC, 10% off = 135 FC (not 100 FC).
    expect(discountedPrice(15_000, { kind: "percent", value: 10 }, "CDF")).toBe(13_500);
    // 3 000 FC, 15% off = 2 550 FC → nearest 100 FC (100 FC ≤ 5% of 3 000).
    expect(discountedPrice(300_000, { kind: "percent", value: 15 }, "CDF")).toBe(260_000);
    // 1 500 FC, 15% off = 1 275 FC → nearest 10 FC.
    expect(discountedPrice(150_000, { kind: "percent", value: 15 }, "CDF")).toBe(128_000);
    // 50 shillings: whole shillings would be more than 5% → exact cents.
    expect(roundPrice(4_550, "KES", 5_000)).toBe(4_600);
    expect(roundPrice(1_550, "KES", 1_900)).toBe(1_550);
  });

  test("rounding never reaches the normal price or zero", () => {
    expect(roundPrice(9_960, "CDF", 10_000)).toBe(9_960);
    // 1 cent at 1% off: not lowered at all → no sale.
    expect(discountedPrice(1, { kind: "percent", value: 1 }, "USD")).toBeNull();
  });

  test("amount off", () => {
    expect(discountedPrice(2500, { kind: "amount", value: 500 }, "USD")).toBe(2000);
    expect(discountedPrice(2500, { kind: "amount", value: 2500 }, "USD")).toBeNull(); // would be free
    expect(discountedPrice(2500, { kind: "amount", value: 3000 }, "USD")).toBeNull();
  });

  test("set sale price must be lower than the normal price and above zero", () => {
    expect(discountedPrice(2500, { kind: "price", value: 1999 }, "USD")).toBe(1999);
    expect(discountedPrice(2500, { kind: "price", value: 2500 }, "USD")).toBeNull();
    expect(discountedPrice(2500, { kind: "price", value: 3000 }, "USD")).toBeNull();
    expect(discountProblem({ kind: "price", value: 0 })).toBe("amount");
  });

  test("percent must be a whole number from 1 to 90", () => {
    expect(discountProblem({ kind: "percent", value: 0 })).toBe("percent");
    expect(discountProblem({ kind: "percent", value: 91 })).toBe("percent");
    expect(discountProblem({ kind: "percent", value: 12.5 })).toBe("percent");
    expect(discountProblem({ kind: "percent", value: 90 })).toBeNull();
    expect(discountedPrice(2500, { kind: "percent", value: 95 }, "USD")).toBeNull();
  });

  test("steep discounts and the badge percent", () => {
    expect(isSteep(10_000, 2_000)).toBe(false); // exactly 80%
    expect(isSteep(10_000, 1_999)).toBe(true);
    expect(percentOff(2500, 1750)).toBe(30);
    expect(percentOff(10_000, 9_999)).toBe(1);
  });

  test("the product's price change during a sale is followed (computed, never stored)", () => {
    const s = sale({ discount: { kind: "percent", value: 20 } });
    expect(bestSaleFor({ ...dress, price: 2500 }, [s], "USD")?.price).toBe(2000);
    const raised = bestSaleFor({ ...dress, price: 5000 }, [s], "USD");
    expect(raised).toMatchObject({ price: 4000, original: 5000 });
    // A set price above the new normal price stops applying.
    expect(bestSaleFor({ ...dress, price: 1500 }, [sale({ discount: { kind: "price", value: 1800 } })], "USD")).toBeNull();
  });
});

describe("targets", () => {
  test("chosen products, a category with exclusions, the whole shop with exclusions", () => {
    const chosen = sale({ target: { kind: "products", productIds: ["p2" as never] } });
    expect(affectedProducts(chosen, [dress, shoes], "USD").map((a) => a.product._id)).toEqual(["p2"]);
    const category = sale({ target: { kind: "category", category: "clothes", excludedIds: [] } });
    expect(affectedProducts(category, [dress, shoes], "USD").map((a) => a.product._id)).toEqual(["p1"]);
    const excluded = sale({ target: { kind: "shop", excludedIds: ["p1" as never] } });
    expect(affectedProducts(excluded, [dress, shoes], "USD").map((a) => a.product._id)).toEqual(["p2"]);
  });
});

describe("overlapping sales", () => {
  test("the best price for the customer wins", () => {
    const thirty = sale({ _id: "a", discount: { kind: "percent", value: 30 } });
    const fiveOff = sale({ _id: "b", discount: { kind: "amount", value: 500 } });
    const setPrice = sale({ _id: "c", discount: { kind: "price", value: 1500 } });
    expect(bestSaleFor(dress, [thirty, fiveOff], "USD")).toMatchObject({ saleId: "a", price: 1750 });
    expect(bestSaleFor(dress, [thirty, fiveOff, setPrice], "USD")).toMatchObject({ saleId: "c", price: 1500 });
    // On the shoes, $5 off beats nothing better: 30% → 70.00, $5 → 95.00.
    expect(bestSaleFor(shoes, [fiveOff, thirty], "USD")).toMatchObject({ saleId: "a", price: 7000 });
  });

  test("a tie goes to the sale ending first", () => {
    const later = sale({ _id: "a", endsAt: NOW + 2 * DAY });
    const sooner = sale({ _id: "b", endsAt: NOW + DAY });
    expect(bestSaleFor(dress, [later, sooner], "USD")?.saleId).toBe("b");
  });

  test("the seller is told which other sales overlap on the same products", () => {
    const mine = sale({ _id: "a", target: { kind: "category", category: "clothes", excludedIds: [] } });
    const sameTime = sale({ _id: "b" });
    const later = sale({ _id: "c", startsAt: NOW + 2 * DAY, endsAt: NOW + 3 * DAY });
    const otherProducts = sale({ _id: "d", target: { kind: "category", category: "shoes", excludedIds: [] } });
    const result = overlappingSales(mine, [mine, sameTime, later, otherProducts], [dress, shoes], "USD");
    expect(result.map((o) => o.sale._id)).toEqual(["b"]);
    expect(result[0].products).toBe(1);
  });
});

describe("when a sale is live", () => {
  test("start and end are UTC instants: the same in every time zone", () => {
    // A sale entered as 20 Nov 00:00 in Kinshasa (UTC+1) and in Nairobi (UTC+3).
    const kinshasa = Date.UTC(2026, 10, 19, 23, 0);
    const nairobi = Date.UTC(2026, 10, 19, 21, 0);
    const s = sale({ startsAt: kinshasa, endsAt: kinshasa + DAY });
    expect(saleLiveAt(s, nairobi)).toBe(false); // midnight in Nairobi is 22:00 in Kinshasa
    expect(saleLiveAt(s, kinshasa)).toBe(true);
    expect(saleLiveAt(s, kinshasa + DAY - 1)).toBe(true);
    expect(saleLiveAt(s, kinshasa + DAY)).toBe(false); // the end is exclusive
  });

  test("scheduled, running, paused (by seller or admin) and ended", () => {
    expect(saleStatusAt(sale({ startsAt: NOW + HOUR }), NOW)).toBe("scheduled");
    expect(saleStatusAt(sale(), NOW)).toBe("running");
    expect(saleStatusAt(sale({ paused: true }), NOW)).toBe("paused");
    expect(saleLiveAt(sale({ paused: true }), NOW)).toBe(false);
    expect(saleLiveAt(sale({ adminPause: { at: NOW, reason: "Misleading" } }), NOW)).toBe(false);
    expect(saleLiveAt(sale({ adminPause: null }), NOW)).toBe(true);
    expect(saleStatusAt(sale({ endsAt: NOW, paused: true }), NOW)).toBe("ended");
  });
});

describe("schedule rules", () => {
  test("same limits as event banners, plus an end in the future", () => {
    expect(saleScheduleProblem({ endsAt: NOW + DAY }, NOW)).toBeNull();
    expect(saleScheduleProblem({ endsAt: NOW - 1 }, NOW)).toBe("ended");
    expect(saleScheduleProblem({ startsAt: NOW + DAY, endsAt: NOW + HOUR }, NOW)).toBe("order");
    expect(saleScheduleProblem({ endsAt: NOW + 93 * DAY }, NOW)).toBe("tooLong");
    expect(saleScheduleProblem({ startsAt: NOW + 400 * DAY, endsAt: NOW + 401 * DAY }, NOW)).toBe("tooFar");
    // A running sale keeps its start in the past.
    expect(saleScheduleProblem({ startsAt: NOW - 10 * DAY, endsAt: NOW + DAY }, NOW)).toBeNull();
  });

  test("presets give valid schedules", () => {
    for (const preset of SALE_PRESETS) {
      const p = presetValues(preset, NOW);
      expect(saleScheduleProblem(p, NOW), preset).toBeNull();
    }
    expect(presetValues("flash", NOW).endsAt).toBe(NOW + DAY);
    expect(new Date(blackFridayOf(2026)).getDate()).toBe(27);
    expect(new Date(blackFridayOf(2026)).getDay()).toBe(5);
  });
});
