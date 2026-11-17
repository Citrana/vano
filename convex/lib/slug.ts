/**
 * Shop slug rules (CLAUDE.md "Shared validation"), shared by the server and
 * the onboarding form. A slug is the shop's public URL: `/<slug>`.
 */

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slugs that would shadow an app route or look official. Every top-level
 * route folder in `src/app/` must be listed here (checked by a test).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Required by the spec.
  "admin",
  "api",
  "dashboard",
  "login",
  "signup",
  "settings",
  // Other app routes and well-known paths.
  "onboarding",
  "logout",
  "signin",
  "register",
  "account",
  "auth",
  "static",
  "public",
  "assets",
  "images",
  "about",
  "help",
  "features",
  "demo",
  "support",
  "contact",
  "terms",
  "privacy",
  "legal",
  "blog",
  "pricing",
  "www",
  "app",
  "vano",
  "shop",
  "shops",
  "en",
  "fr",
]);

export type SlugProblem = "length" | "format" | "reserved";

export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return "length";
  if (!SLUG_PATTERN.test(slug)) return "format";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}

/** "Chez Amani – Mode!" → "chez-amani-mode". May return "" or a reserved word. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}
