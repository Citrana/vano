import { isLanguage, type Language } from "../../convex/lib/catalog";

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const DEFAULT_LOCALE: Language = "en";

/**
 * Picks "en" or "fr" from an Accept-Language header ("fr-CD,fr;q=0.9,en;q=0.8"),
 * honouring q-values. Falls back to English.
 */
export function localeFromAcceptLanguage(header: string | null): Language {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number(q.trim().slice(2)) : 1;
      return { base: tag.trim().toLowerCase().split("-")[0], quality, index };
    })
    .filter((entry) => Number.isFinite(entry.quality) && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  const match = ranked.find((entry) => isLanguage(entry.base));
  return match && isLanguage(match.base) ? match.base : DEFAULT_LOCALE;
}

export function resolveLocale(cookie: string | undefined, acceptLanguage: string | null): Language {
  return isLanguage(cookie) ? cookie : localeFromAcceptLanguage(acceptLanguage);
}
