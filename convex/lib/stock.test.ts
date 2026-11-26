import { describe, expect, test } from "vitest";
import { FEW_LEFT_MAX, isTracked, piecesProblem, stockFlags, takePieces } from "./stock";

describe("pieces in stock", () => {
  test("Few left at 3 or fewer, Sold out at 0", () => {
    expect(FEW_LEFT_MAX).toBe(3);
    expect(stockFlags(0)).toEqual({ soldOut: true, fewLeft: false });
    expect(stockFlags(1)).toEqual({ soldOut: false, fewLeft: true });
    expect(stockFlags(3)).toEqual({ soldOut: false, fewLeft: true });
    expect(stockFlags(4)).toEqual({ soldOut: false, fewLeft: false });
  });

  test("a sale takes its quantity, never more than what's left", () => {
    expect(takePieces(1, 1)).toBe(0);
    expect(takePieces(5, 2)).toBe(3);
    expect(takePieces(2, 3)).toBe("notEnough");
  });

  test("valid counts", () => {
    expect(piecesProblem(0)).toBeNull();
    expect(piecesProblem(99_999)).toBeNull();
    expect(piecesProblem(-1)).toBe("range");
    expect(piecesProblem(1.5)).toBe("range");
    expect(piecesProblem(100_000)).toBe("range");
    // A new product needs at least one piece.
    expect(piecesProblem(0, { creating: true })).toBe("range");
    expect(piecesProblem(1, { creating: true })).toBeNull();
  });

  test("tracked only with a count and the plan feature", () => {
    expect(isTracked({ pieces: 3 }, { features: ["stockManagement"] })).toBe(true);
    expect(isTracked({}, { features: ["stockManagement"] })).toBe(false);
    expect(isTracked({ pieces: 3 }, { features: [] })).toBe(false);
  });
});
