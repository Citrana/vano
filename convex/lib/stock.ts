import type { PlanLimits } from "./planFeatures";

/**
 * Pieces in stock (CLAUDE.md "Sales tracking"): a count per product
 * (`products.pieces`, required by the form on every plan; missing only on
 * products saved before it was, = not tracked). While the plan has
 * `stockManagement`, the count drives "Few left" (3 or fewer) and "Sold
 * out" (0), and each recorded sale takes its quantity. Pure.
 */

export const FEW_LEFT_MAX = 3;
export const PIECES_MAX = 99_999;

/**
 * The pieces count is required in the product form on every plan: a whole
 * number up to PIECES_MAX, at least 1 for a new product (0 is fine on an
 * edit: the product is sold out).
 */
export function piecesProblem(pieces: number, options: { creating?: boolean } = {}): "range" | null {
  const min = options.creating ? 1 : 0;
  return Number.isInteger(pieces) && pieces >= min && pieces <= PIECES_MAX ? null : "range";
}

/** What the count shows on the shop. */
export function stockFlags(pieces: number): { soldOut: boolean; fewLeft: boolean } {
  return { soldOut: pieces <= 0, fewLeft: pieces > 0 && pieces <= FEW_LEFT_MAX };
}

/** The count after selling `quantity`, or "notEnough". */
export function takePieces(pieces: number, quantity: number): number | "notEnough" {
  return quantity > pieces ? "notEnough" : pieces - quantity;
}

/** Whether the count drives the product's labels: set, and the plan has `stockManagement`. */
export function isTracked(product: { pieces?: number }, limits: Pick<PlanLimits, "features">): boolean {
  return product.pieces !== undefined && limits.features.includes("stockManagement");
}
