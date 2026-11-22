import { describe, expect, test } from "vitest";
import { stockChange } from "./restock";

describe("stockChange", () => {
  test("turning Sold out off marks it back in stock", () => {
    expect(stockChange({ soldOut: true }, false, 5)).toEqual({
      fields: { soldOut: false, restockedAt: 5, backInStock: true, fewLeft: undefined },
      restocked: true,
    });
  });
  test("sold out again: no longer back in stock, no Few left", () => {
    expect(stockChange({ soldOut: false, restockedAt: 5, backInStock: true, fewLeft: true }, true, 9)).toEqual({
      fields: { soldOut: true, restockedAt: undefined, backInStock: undefined, fewLeft: undefined },
      restocked: false,
    });
  });
  test("no change keeps everything", () => {
    expect(stockChange({ soldOut: false, restockedAt: 5, backInStock: true, fewLeft: true }, false, 9)).toEqual({
      fields: { soldOut: false, restockedAt: 5, backInStock: true, fewLeft: true },
      restocked: false,
    });
  });
});
