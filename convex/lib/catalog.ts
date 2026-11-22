import { v, type Infer } from "convex/values";

/**
 * Catalogue constants shared by the server and the UI (CLAUDE.md "Shared
 * validation"). Labels are translated in `messages/*.json` under
 * `Categories.<key>` / `Languages.<key>`.
 */

export const CATEGORY_KEYS = [
  "clothes",
  "shoes",
  "bags",
  "underwear",
  "accessories",
  "other",
] as const;

export const categoryValidator = v.union(
  v.literal("clothes"),
  v.literal("shoes"),
  v.literal("bags"),
  v.literal("underwear"),
  v.literal("accessories"),
  v.literal("other"),
);
export type Category = Infer<typeof categoryValidator>;

export const LANGUAGES = ["en", "fr"] as const;
export const languageValidator = v.union(v.literal("en"), v.literal("fr"));
export type Language = Infer<typeof languageValidator>;

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "fr";
}

export const LIMITS = {
  passwordMin: 8,
  shopNameMin: 2,
  shopNameMax: 60,
  shopDescriptionMax: 300,
  cityMax: 60,
  productNameMin: 2,
  productNameMax: 80,
  productDescriptionMax: 1000,
  minImages: 1,
  maxImages: 6,
  maxTags: 20,
  tagMax: 20,
  maxProducts: 200,
} as const;

/** Trims, drops empties and case-insensitive duplicates (keeps first spelling). */
export function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, " ");
    const key = tag.toLowerCase();
    if (tag === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** "tooMany" | "tooLong" | null, for already-cleaned tags. */
export function tagsProblem(tags: readonly string[]): "tooMany" | "tooLong" | null {
  if (tags.length > LIMITS.maxTags) return "tooMany";
  if (tags.some((tag) => tag.length > LIMITS.tagMax)) return "tooLong";
  return null;
}

/** Colours (and sizes) shown on a product card; the rest is "+N". */
export const CARD_TAGS_MAX = 4;
