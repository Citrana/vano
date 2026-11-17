import { LIMITS } from "./catalog";

/**
 * Email / password rules for accounts, shared by sign-up (`convex/auth.ts`)
 * and the `seed:superAdmin` command so both accept exactly the same input
 * (CLAUDE.md "Shared validation").
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, lowercased email, or null if it isn't a valid address. */
export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? "")
    .trim()
    .toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function passwordProblem(password: string): "too_short" | null {
  return password.length < LIMITS.passwordMin ? "too_short" : null;
}
