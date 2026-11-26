import type { Category } from "./catalog";

/**
 * Product codes (CLAUDE.md "Product details"): an optional short reference
 * the seller gives a product ("CLO-001"), unique per shop, case
 * insensitive (stored upper case, `products.by_shopId_and_code`). Shown on
 * seller screens and in the WhatsApp order message. Pure: the form and
 * `products.create` / `update` / `suggestCode` share it.
 */

export const PRODUCT_CODE_MIN = 2;
export const PRODUCT_CODE_MAX = 16;

/** The prefix `suggestProductCode` uses per category. */
export const CODE_PREFIX: Record<Category, string> = {
  clothes: "CLO",
  shoes: "SHO",
  bags: "BAG",
  underwear: "UND",
  accessories: "ACC",
  other: "OTH",
};

/** Trimmed, upper case, inner spaces as "-" ("clo 1" → "CLO-1"). */
export function normalizeProductCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "-");
}

/** "length" | "chars" | null, for a normalised code. */
export function productCodeProblem(code: string): "length" | "chars" | null {
  if (code.length < PRODUCT_CODE_MIN || code.length > PRODUCT_CODE_MAX) return "length";
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) return "chars";
  return null;
}

/**
 * The next free code for a category: its prefix and the highest running
 * number already used with that prefix + 1, at least 3 digits
 * ("CLO-001", "CLO-002", …). Other codes are ignored; the result is never
 * one of `existing`.
 */
export function suggestProductCode(category: Category, existing: readonly string[]): string {
  const prefix = CODE_PREFIX[category];
  const taken = new Set(existing.map(normalizeProductCode));
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let highest = 0;
  for (const code of taken) {
    const match = pattern.exec(code);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  let next = highest + 1;
  let code = `${prefix}-${String(next).padStart(3, "0")}`;
  while (taken.has(code)) code = `${prefix}-${String(++next).padStart(3, "0")}`;
  return code;
}
