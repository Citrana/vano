import { describe, expect, test } from "vitest";
import { filterAccess, FULL_FILTERS_MIN_PRODUCTS, NO_FILTER_ACCESS } from "./filters";

const many = FULL_FILTERS_MIN_PRODUCTS;
const few = FULL_FILTERS_MIN_PRODUCTS - 1;

describe("filterAccess", () => {
  test("auto: full filters only from the minimum product count", () => {
    expect(filterAccess({ mode: undefined, entitled: true, productCount: many })).toEqual({
      show: true,
      categories: true,
      sale: true,
      panel: true,
    });
    expect(filterAccess({ mode: "auto", entitled: true, productCount: few })).toEqual({
      show: true,
      categories: false,
      sale: true,
      panel: false,
    });
  });

  test("Free gets category chips and sort, never the Sale chip or the panel", () => {
    expect(filterAccess({ mode: "auto", entitled: false, productCount: many })).toEqual({
      show: true,
      categories: true,
      sale: false,
      panel: false,
    });
    expect(filterAccess({ mode: "on", entitled: false, productCount: 2 })).toEqual({
      show: true,
      categories: true,
      sale: false,
      panel: false,
    });
    expect(filterAccess({ mode: "auto", entitled: false, productCount: few })).toEqual({
      show: true,
      categories: false,
      sale: false,
      panel: false,
    });
  });

  test("on: everything whatever the count; off: nothing", () => {
    expect(filterAccess({ mode: "on", entitled: true, productCount: 1 }).panel).toBe(true);
    expect(filterAccess({ mode: "off", entitled: true, productCount: 50 })).toEqual(NO_FILTER_ACCESS);
  });
});
