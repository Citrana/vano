/**
 * The code text (CLAUDE.md "Discount codes"). Pure; the editor, the
 * product page and the server use the same rules. Codes are not case
 * sensitive: they are stored and compared upper case, spaces removed.
 */

export const CODE_MIN = 3;
export const CODE_MAX = 20;
const CODE_RE = /^[A-Z0-9]+$/;

/** What the customer or seller typed, as stored: no spaces, upper case. */
export function normalizeCode(text: string): string {
  return text.replace(/\s+/g, "").toUpperCase();
}

/** Problems with an already normalised code. */
export function codeTextProblem(code: string): "length" | "chars" | null {
  if (code.length < CODE_MIN || code.length > CODE_MAX) return "length";
  return CODE_RE.test(code) ? null : "chars";
}

/** Letters and digits that can't be mixed up (no 0 / O, 1 / I / L). */
const SUGGEST_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SUGGEST_LENGTH = 8;

/** A random, easy-to-read code ("Suggest one"). */
export function suggestCode(random: () => number = Math.random, length = SUGGEST_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SUGGEST_ALPHABET[Math.min(SUGGEST_ALPHABET.length - 1, Math.floor(random() * SUGGEST_ALPHABET.length))];
  }
  return out;
}
